import { useCallback, useEffect, useRef, useState } from "react";
import { useDrugCatalog } from "../../../hooks/useDrugCatalog";
import type {
  AmbientConsultationResponse,
  PrescriptionDraftItem,
  SoapNote,
} from "../../../services/clinicalApi";
import { resolvePrescriptionDraft } from "../data/rxMapper";
import {
  diarizedToTranscriptLines,
  icdSuggestionsToCodes,
  isSoapNoteEmpty,
  soapNoteToDraft,
} from "../data/ambientMapper";
import type { IcdCode, RxLine, SoapDraft, TranscriptLine } from "../data/doctorMockData";

export type ConsultationStatus =
  | "IDLE"
  | "RECORDING"
  | "ANALYZING"
  | "DRAFT_READY"
  | "APPROVED";

function emptyDraft(): SoapDraft {
  return { subjective: "", objective: "", assessment: "", plan: "" };
}

/**
 * State machine of one ambient consultation.
 *
 * The microphone itself (and the `01:24` clock) lives in `AmbientRecordingBar`
 * via `useAudioRecorder`; this hook owns what happens to the *record*: which
 * status the workspace is in, the diarised transcript, the SOAP draft, the
 * accepted ICD-10 codes and the prescription lines. Nothing here ever sees an
 * audio file - only the analysis the AI Gateway returned.
 */
export function useAmbientConsultation() {
  const [status, setStatus] = useState<ConsultationStatus>("IDLE");
  const [revealedLines, setRevealedLines] = useState<TranscriptLine[]>([]);
  const [soapDraft, setSoapDraft] = useState<SoapDraft>(emptyDraft);
  const [icdAccepted, setIcdAccepted] = useState<IcdCode[]>([]);
  const [icdSuggestions, setIcdSuggestions] = useState<IcdCode[]>([]);
  const [rxLines, setRxLines] = useState<RxLine[]>([]);

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

  const start = useCallback(() => {
    clearDraft();
    setStatus("RECORDING");
  }, [clearDraft]);

  const finish = useCallback(() => {
    setStatus("ANALYZING");
  }, []);

  /** Analysis failed: back to idle so the doctor can re-record or write by hand. */
  const failAnalysis = useCallback(() => {
    clearDraft();
    setStatus("IDLE");
  }, [clearDraft]);

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
    setStatus("APPROVED");
    approveRef.current = window.setTimeout(() => {
      clearDraft();
      setStatus("IDLE");
      approveRef.current = null;
    }, 1500);
  }, [clearDraft]);

  return {
    status,
    revealedLines,
    soapDraft,
    setSoapDraft,
    icdAccepted,
    setIcdAccepted,
    icdSuggestions,
    rxLines,
    setRxLines,
    start,
    finish,
    failAnalysis,
    applyConsultation,
    applyCopilotUpdate,
    approve,
  };
}
