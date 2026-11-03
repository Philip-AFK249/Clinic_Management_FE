import { useCallback, useEffect, useRef, useState } from "react";
import { useDrugCatalog } from "../../../hooks/useDrugCatalog";
import { useAudioRecorder } from "../../../hooks/useAudioRecorder";
import type {
  AmbientConsultationResponse,
  CopilotChatResponse,
  PrescriptionDraftItem,
  SoapNote,
} from "../../../services/clinicalApi";
import { resolvePrescriptionDraft } from "../data/rxMapper";
import {
  diagnosesToCodes,
  diarizedToTranscriptLines,
  icdSuggestionsToCodes,
  isSoapNoteEmpty,
  normalizePrescriptionDraft,
  soapNoteToDraft,
} from "../data/ambientMapper";
import type { IcdCode, RxLine, SoapDraft, TranscriptLine } from "../data/doctorMockData";

export type ConsultationStatus =
  | "IDLE"
  | "RECORDING"
  | "ANALYZING"
  | "DRAFT_READY"
  | "APPROVED";

/** Which kind of clip the microphone is currently capturing. */
export type RecordingMode = "INITIAL" | "FOLLOW_UP";

/** Outcome of a request to open the microphone. */
export type RecordingStartResult = "started" | "cancelled" | "failed";

export const RE_RECORD_CONFIRM_MESSAGE =
  "Ghi âm lại từ đầu sẽ xóa bản tóm tắt AI hiện tại và phân tích lại từ bản ghi âm mới. Bạn có chắc chắn muốn tiếp tục?";

function emptyDraft(): SoapDraft {
  return { subjective: "", objective: "", assessment: "", plan: "" };
}

function isSoapDraftEmpty(draft: SoapDraft): boolean {
  return (
    !draft.subjective.trim() &&
    !draft.objective.trim() &&
    !draft.assessment.trim() &&
    !draft.plan.trim()
  );
}

/**
 * Apply a revised SOAP note without erasing sections the AI left blank. The
 * follow-up turn is supposed to *add* to the chart, so an empty field means
 * "unchanged", not "delete what the doctor already wrote".
 */
function mergeSoapDraft(current: SoapDraft, note: SoapNote): SoapDraft {
  const next = soapNoteToDraft(note);
  return {
    subjective: next.subjective.trim() ? next.subjective : current.subjective,
    objective: next.objective.trim() ? next.objective : current.objective,
    assessment: next.assessment.trim() ? next.assessment : current.assessment,
    plan: next.plan.trim() ? next.plan : current.plan,
  };
}

/**
 * State machine of one ambient consultation.
 *
 * This hook owns the microphone too: the initial consultation and a short
 * voice follow-up differ only in what happens to the clip after it stops, so
 * keeping the recorder here lets both modes share one timer, one cancel path
 * and one guard against opening the mic twice.
 */
export function useAmbientConsultation() {
  const [status, setStatus] = useState<ConsultationStatus>("IDLE");
  const [recordingMode, setRecordingMode] = useState<RecordingMode | null>(null);
  const [revealedLines, setRevealedLines] = useState<TranscriptLine[]>([]);
  const [soapDraft, setSoapDraft] = useState<SoapDraft>(emptyDraft);
  const [icdAccepted, setIcdAccepted] = useState<IcdCode[]>([]);
  const [icdSuggestions, setIcdSuggestions] = useState<IcdCode[]>([]);
  const [rxLines, setRxLines] = useState<RxLine[]>([]);

  const recorder = useAudioRecorder();
  const {
    startRecording,
    stopRecording: stopMicrophone,
    cancelRecording: cancelMicrophone,
    reset: resetMicrophone,
    isRecording,
    isProcessing,
    recordingTime,
    isSupported,
    error: recorderError,
  } = recorder;

  // The gateway proposes drug *names*; the prescription that reaches
  // ClinicalConsultationService needs the real `drugs.id` and the live stock,
  // so the draft is resolved against the live formulary.
  const catalog = useDrugCatalog();

  const approveRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (approveRef.current !== null) window.clearTimeout(approveRef.current);
    };
  }, []);

  const clearDraft = useCallback(() => {
    setRevealedLines([]);
    setSoapDraft(emptyDraft());
    setIcdAccepted([]);
    setIcdSuggestions([]);
    setRxLines([]);
  }, []);

  /**
   * True once there is an AI summary (or a manual edit) worth protecting from
   * the re-record confirmation.
   */
  const hasConsultationContent =
    revealedLines.length > 0 ||
    !isSoapDraftEmpty(soapDraft) ||
    icdAccepted.length > 0 ||
    rxLines.length > 0;

  const beginRecording = useCallback(
    async (mode: RecordingMode): Promise<RecordingStartResult> => {
      if (!isSupported) return "failed";

      // Never leave a previous stream open: two recorders on one mic produce
      // one silent file and one wildly over-long timer.
      if (isRecording || isProcessing) {
        cancelMicrophone();
        resetMicrophone();
      }

      try {
        const started = await startRecording();
        if (!started) return "failed";
      } catch {
        return "failed";
      }

      setRecordingMode(mode);
      if (mode === "INITIAL") clearDraft();
      setStatus("RECORDING");
      return "started";
    },
    [
      cancelMicrophone,
      clearDraft,
      isProcessing,
      isRecording,
      isSupported,
      resetMicrophone,
      startRecording,
    ],
  );

  /** Open the mic for the full consultation recording. */
  const start = useCallback(
    () => beginRecording("INITIAL"),
    [beginRecording],
  );

  /**
   * Secondary recording mode: a short clip that revises the current SOAP /
   * ICD-10 / prescription instead of replacing the encounter.
   */
  const recordFollowUp = useCallback(
    () => beginRecording("FOLLOW_UP"),
    [beginRecording],
  );

  /**
   * Replace a failed or noisy clip with a clean full recording. Anything the
   * AI already produced is discarded, but only after the doctor confirms.
   */
  const reRecord = useCallback(
    async (force = false): Promise<RecordingStartResult> => {
      if (!force && hasConsultationContent) {
        const confirmed =
          typeof window !== "undefined" &&
          window.confirm(RE_RECORD_CONFIRM_MESSAGE);
        if (!confirmed) return "cancelled";
      }
      return beginRecording("INITIAL");
    },
    [beginRecording, hasConsultationContent],
  );

  /**
   * Stop capture and hand the in-memory clip to the caller. A too-short clip
   * returns `null` and restores the status the mode started from.
   */
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    const mode = recordingMode;
    const audioBlob = await stopMicrophone();

    if (!audioBlob) {
      setRecordingMode(null);
      setStatus(mode === "FOLLOW_UP" ? "DRAFT_READY" : "IDLE");
      return null;
    }

    setStatus("ANALYZING");
    return audioBlob;
  }, [recordingMode, stopMicrophone]);

  /**
   * Abort the current clip. A cancelled follow-up keeps the existing chart; a
   * cancelled initial recording leaves an empty, idle workspace.
   */
  const cancelRecording = useCallback(() => {
    const mode = recordingMode;
    if (!mode) return;
    cancelMicrophone();
    resetMicrophone();
    setRecordingMode(null);
    if (mode === "FOLLOW_UP") {
      setStatus("DRAFT_READY");
    } else {
      clearDraft();
      setStatus("IDLE");
    }
  }, [cancelMicrophone, clearDraft, recordingMode, resetMicrophone]);

  const finish = useCallback(() => {
    setStatus("ANALYZING");
  }, []);

  /** Analysis failed: back to idle so the doctor can re-record or write by hand. */
  const failAnalysis = useCallback(() => {
    clearDraft();
    setRecordingMode(null);
    setStatus("IDLE");
  }, [clearDraft]);

  /** A failed follow-up must leave the existing draft exactly as it was. */
  const failFollowUp = useCallback(() => {
    setRecordingMode(null);
    setStatus("DRAFT_READY");
  }, []);

  /**
   * Bind a successful ambient analysis onto the workspace: diarised dialogue to
   * the transcript panel, SOAP to the note editor, ICD-10 to the selector and
   * the in-stock draft to the prescribing table.
   */
  const applyConsultation = useCallback(
    (result: AmbientConsultationResponse) => {
      setRevealedLines(diarizedToTranscriptLines(result.diarized_transcript));
      setSoapDraft(soapNoteToDraft(result.soap_note));
      const codes = icdSuggestionsToCodes(result.icd10_suggestions);
      setIcdSuggestions(codes);
      setIcdAccepted(codes);
      setRxLines(
        resolvePrescriptionDraft(result.prescription_draft ?? [], catalog.drugs),
      );
      setRecordingMode(null);
      setStatus("DRAFT_READY");
    },
    [catalog.drugs],
  );

  /**
   * Bind a voice follow-up answer back into the open chart. Sections the AI did
   * not change stay as they are, so dictating one new allergy cannot wipe the
   * rest of the encounter.
   */
  const applyFollowUp = useCallback(
    (result: CopilotChatResponse) => {
      const note = result.soap_note;
      if (note && !isSoapNoteEmpty(note)) {
        setSoapDraft((current) => mergeSoapDraft(current, note));
      }

      const codes = diagnosesToCodes(result.diagnoses);
      if (codes.length > 0) {
        setIcdSuggestions(codes);
        setIcdAccepted(codes);
      }

      const prescriptionDraft = normalizePrescriptionDraft(
        result.prescription_draft,
      );
      if (prescriptionDraft.length > 0) {
        setRxLines(resolvePrescriptionDraft(prescriptionDraft, catalog.drugs));
      }

      setRecordingMode(null);
      setStatus("DRAFT_READY");
    },
    [catalog.drugs],
  );

  /**
   * Re-sync the record with a copilot turn. Whatever the AI did not refine is
   * left untouched, so a reply that only rewrites the plan cannot wipe the
   * diagnoses the doctor already accepted.
   */
  const applyCopilotUpdate = useCallback(
    (update: {
      soapNote?: SoapNote;
      icdCodes?: IcdCode[];
      prescriptionDraft?: PrescriptionDraftItem[];
    }) => {
      if (update.soapNote && !isSoapNoteEmpty(update.soapNote)) {
        setSoapDraft(soapNoteToDraft(update.soapNote));
      }
      if (update.icdCodes && update.icdCodes.length > 0) {
        setIcdSuggestions(update.icdCodes);
        setIcdAccepted(update.icdCodes);
      }
      if (update.prescriptionDraft && update.prescriptionDraft.length > 0) {
        setRxLines(resolvePrescriptionDraft(update.prescriptionDraft, catalog.drugs));
      }
    },
    [catalog.drugs],
  );

  const approve = useCallback(() => {
    if (approveRef.current !== null) window.clearTimeout(approveRef.current);
    setRecordingMode(null);
    setStatus("APPROVED");
    approveRef.current = window.setTimeout(() => {
      clearDraft();
      setStatus("IDLE");
      approveRef.current = null;
    }, 1500);
  }, [clearDraft]);

  return {
    status,
    recordingMode,
    hasConsultationContent,
    // Microphone state, forwarded so the bar can render one source of truth.
    isRecording,
    recordingTime,
    isProcessing,
    isSupported,
    recorderError,
    revealedLines,
    soapDraft,
    setSoapDraft,
    icdAccepted,
    setIcdAccepted,
    icdSuggestions,
    rxLines,
    setRxLines,
    start,
    recordFollowUp,
    reRecord,
    stopRecording,
    cancelRecording,
    finish,
    failAnalysis,
    failFollowUp,
    applyConsultation,
    applyFollowUp,
    applyCopilotUpdate,
    approve,
  };
}
