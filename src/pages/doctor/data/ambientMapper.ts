import type {
  DiarizedMessage,
  Icd10Suggestion,
  SoapNote,
} from "../../../services/clinicalApi";
import type { IcdCode, SoapDraft, TranscriptLine } from "./doctorMockData";

/**
 * Bridges the FastAPI AI Gateway payloads onto the shapes the EHR workspace
 * already edits. The gateway speaks `snake_case` (like `voiceTriageApi`), the
 * workspace speaks the seeded mock types, so every binding happens here rather
 * than inside a component.
 */

/** `mm:ss` for an offset the gateway gave as raw seconds. */
function clockFromSeconds(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function soapNoteToDraft(note: SoapNote | null | undefined): SoapDraft {
  return {
    subjective: note?.subjective ?? "",
    objective: note?.objective ?? "",
    assessment: note?.assessment ?? "",
    plan: note?.plan ?? "",
  };
}

export function soapDraftToNote(draft: SoapDraft): SoapNote {
  return {
    subjective: draft.subjective,
    objective: draft.objective,
    assessment: draft.assessment,
    plan: draft.plan,
  };
}

export function isSoapNoteEmpty(note: SoapNote | null | undefined): boolean {
  return !note?.subjective?.trim() && !note?.objective?.trim() && !note?.assessment?.trim() && !note?.plan?.trim();
}

/**
 * ICD-10 suggestions -> the selector's `IcdCode` list, primary first so that
 * `toDiagnoses` flags the LLM's main diagnosis as `isPrimary` without the
 * caller having to re-sort anything.
 */
export function icdSuggestionsToCodes(
  suggestions: Icd10Suggestion[] | null | undefined,
): IcdCode[] {
  if (!Array.isArray(suggestions)) return [];
  return [...suggestions]
    .filter((item) => typeof item?.icd10_code === "string" && item.icd10_code.trim())
    .sort((a, b) => Number(b.is_primary === true) - Number(a.is_primary === true))
    .map((item) => ({
      code: item.icd10_code.trim(),
      label: item.disease_name?.trim() || item.icd10_code.trim(),
      confidence: Math.max(0, Math.min(100, Math.round(item.ai_confidence ?? 0))),
    }));
}

/**
 * Diarised dialogue -> transcript lines.
 *
 * The gateway may label a third party (`OTHER`, a nurse or a relative); the
 * panel only knows two roles, so anything that is not the doctor is shown on
 * the patient side rather than being dropped from the record.
 */
export function diarizedToTranscriptLines(
  messages: DiarizedMessage[] | null | undefined,
): TranscriptLine[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => typeof message?.text === "string" && message.text.trim())
    .map((message, index) => ({
      id: `D-${index + 1}`,
      speaker: message.speaker === "DOCTOR" ? "DOCTOR" : "PATIENT",
      timeOffset:
        message.time_offset?.trim() ||
        clockFromSeconds(message.start_seconds ?? index * 4),
      text: message.text.trim(),
      entities: [],
    }));
}
