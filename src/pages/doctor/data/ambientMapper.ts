import type {
  DiagnosisItem,
  DiarizedMessage,
  Icd10Suggestion,
  PrescriptionDraftItem,
  PrescriptionDraftWire,
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
 * The copilot turn's `diagnoses` - camelCase `icd10Code` on the gateway, with
 * the snake_case `icd10_code` spelling accepted too - onto the selector's
 * `IcdCode` list, primary first so the first chip stays the main diagnosis.
 */
export function diagnosesToCodes(
  diagnoses:
    | (Partial<DiagnosisItem> & Partial<Icd10Suggestion>)[]
    | null
    | undefined,
): IcdCode[] {
  if (!Array.isArray(diagnoses)) return [];
  return diagnoses
    .map((item) => {
      const code = (item.icd10Code ?? item.icd10_code ?? "").trim();
      const confidence = Math.round(
        Number(item.aiConfidence ?? item.ai_confidence ?? 0) || 0,
      );
      return {
        code,
        label: (item.diseaseName ?? item.disease_name ?? "").trim() || code,
        confidence: Math.max(0, Math.min(100, confidence)),
        isPrimary: (item.isPrimary ?? item.is_primary) === true,
      };
    })
    .filter((item) => item.code)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map(({ code, label, confidence }) => ({ code, label, confidence }));
}

/**
 * The gateway writes its prescription draft camelCase (`drugName`,
 * `routeFrequency`) while the prescribing table reads snake_case - bind the
 * two here so an AI proposal lands as real rows instead of an empty table.
 */
export function normalizePrescriptionDraft(
  items: PrescriptionDraftWire[] | null | undefined,
): PrescriptionDraftItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const quantity = Number(item.quantity);
      return {
        drug_name: (item.drugName ?? item.drug_name ?? "").trim(),
        drug_id: item.drugId ?? item.drug_id,
        concentration: item.concentration ?? "",
        dosage_form: item.dosageForm ?? item.dosage_form ?? "",
        route_frequency: item.routeFrequency ?? item.route_frequency ?? "",
        duration: item.duration ?? "",
        quantity:
          Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1,
        current_stock: item.currentStock ?? item.current_stock ?? 0,
        bhyt_coverage: item.bhytCoverage ?? item.bhyt_coverage ?? "",
      };
    })
    .filter((item) => Boolean(item.drug_name));
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
