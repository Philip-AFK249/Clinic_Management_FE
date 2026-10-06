import axios from "axios";

/**
 * Typed HTTP client for the two-stage voice triage endpoint of the AI Gateway
 * (FastAPI at http://localhost:8000): Whisper transcription followed by a
 * clinical LLM that returns a department, a priority and the live doctor
 * schedule.
 *
 * Same transport as `ocrApi` - requests go through the Vite dev proxy
 * (`/api/v1/triage` -> :8000) so the browser never issues a cross-origin
 * multipart upload. Set `VITE_TRIAGE_API_BASE` to `http://localhost:8000/api/v1`
 * to hit the gateway directly instead.
 */
export const TRIAGE_BASE_URL: string =
  import.meta.env.VITE_TRIAGE_API_BASE ?? "/api/v1";

export const triageApi = axios.create({
  baseURL: TRIAGE_BASE_URL,
  // Two model round-trips plus a schedule query. A 20-second answer is normal;
  // the 60s used for the single-call OCR scan would abort a slow-but-working
  // consultation halfway and lose the transcription with it.
  timeout: 120000,
});

/**
 * Resolve a controller-relative path (`triage/voice-schedule`) onto `triageApi`.
 *
 * Mirrors `ocrPath`: whether the `/triage` segment belongs to `baseURL` or to the
 * endpoint depends on how `VITE_TRIAGE_API_BASE` is set, and guessing wrong emits
 * a duplicated segment.
 */
function triagePath(path: string): string {
  const base = TRIAGE_BASE_URL.replace(/\/+$/, "");
  return base.endsWith("/triage") ? path : `/triage${path}`;
}

// ---------------------------------------------------------------------------
// DTOs - mirror the gateway's `VoiceScheduleTriageResponse` Pydantic model.
// ---------------------------------------------------------------------------

/**
 * How badly the patient needs to be seen, as the clinical LLM classified them.
 *
 * `P1` is not a stylistic choice: it means the LLM read the description as a
 * possible emergency (acute coronary syndrome, anaphylaxis, ...), and the UI has
 * to interrupt the booking to say so.
 */
export type TriagePriorityLevel = "P1" | "P2" | "P3";

/** Which half of the working day the dispatcher should prefer. */
export type RecommendedShift = "MORNING" | "AFTERNOON" | "NEXT_DAY" | "NO_DUTY";

/** The two sessions a clinic day is split into. */
export type SessionName = "MORNING" | "AFTERNOON";

export interface DoctorShiftInfo {
  doctor_id: number;
  doctor_name: string;
  /** Vietnamese professional rank, e.g. `Tiến sĩ`, `Bác sĩ chuyên khoa II`. */
  title: string;
  room_number: string;
  booked_count: number;
  total_capacity: number;
  available_capacity: number;
  is_full: boolean;
}

export interface SessionSchedule {
  session: SessionName;
  /** `07:30 - 11:30` or `13:00 - 17:00`. */
  time_window: string;
  is_full: boolean;
  total_available_slots: number;
  doctors: DoctorShiftInfo[];
}

export interface VoiceScheduleTriageResponse {
  success: boolean;
  /** Whisper output, in the patient's own words. */
  transcription: string;
  /** The complaint as the LLM summarised it, for the clinical record. */
  chief_complaint_summary: string;
  disease_guess: string;
  /** ICD-10 code, e.g. `J30`. May be empty when the LLM would not commit. */
  icd10_code: string;
  department_id: number;
  department_name: string;
  priority_level: TriagePriorityLevel;
  recommended_shift: RecommendedShift;
  advice: string;
  /**
   * Which sessions the schedule service managed to answer for.
   *
   * Both keys are optional: the gateway omits a session it has no data for, and
   * omits both when `clinic_management_doctorschedule_service` is down.
   */
  schedule: {
    MORNING?: SessionSchedule;
    AFTERNOON?: SessionSchedule;
  };
}

/**
 * Why a triage call failed, so the caller can react rather than show one generic
 * message.
 *
 * - `silent`      the clip held no speech - worth asking again, nothing is wrong
 * - `no_schedule` the schedule database is down - triage is still valid, so the
 *                 clinical half of the answer is shown and the shift picker is
 *                 replaced by the ordinary one
 * - `timeout` / `network` / `server` - the usual transport failures
 */
export type VoiceTriageErrorKind =
  | "silent"
  | "no_schedule"
  | "timeout"
  | "network"
  | "server";

export class VoiceTriageError extends Error {
  readonly kind: VoiceTriageErrorKind;
  readonly status?: number;
  /**
   * The triage half of the answer, when the gateway managed to produce it before
   * the schedule lookup failed.
   *
   * A 503 aborts the whole HTTP request, so without this the clinical result
   * would be thrown away along with the rota - the patient would be told the
   * system is down even though their department and priority were decided
   * correctly a moment earlier.
   */
  readonly partial?: VoiceScheduleTriageResponse;

  constructor(
    message: string,
    kind: VoiceTriageErrorKind,
    status?: number,
    partial?: VoiceScheduleTriageResponse,
  ) {
    super(message);
    this.name = "VoiceTriageError";
    this.kind = kind;
    this.status = status;
    this.partial = partial;
  }
}

/** The triage fields alone, when that is all a failed response managed to carry. */
function partialTriage(payload: unknown): VoiceScheduleTriageResponse | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const candidate = payload as Partial<VoiceScheduleTriageResponse>;
  // `department_id` is the discriminator: without it there is nothing to render,
  // and whatever came back is an error document rather than a partial result.
  if (typeof candidate.department_id !== "number") return undefined;
  return {
    success: true,
    transcription: "",
    chief_complaint_summary: "",
    disease_guess: "",
    icd10_code: "",
    department_id: candidate.department_id,
    department_name: typeof candidate.department_name === "string" ? candidate.department_name : "",
    priority_level: candidate.priority_level ?? "P3",
    recommended_shift: candidate.recommended_shift ?? "NO_DUTY",
    advice: typeof candidate.advice === "string" ? candidate.advice : "",
    schedule: {},
  };
}

/**
 * Read the `detail` a FastAPI error carries.
 *
 * Handles both shapes the gateway emits: a plain string, and the list-of-objects
 * that a schema-validation failure produces.
 */
function detailOf(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: unknown };
    return typeof first?.msg === "string" ? first.msg.trim() : "";
  }
  return "";
}

/** Today's date as `YYYY-MM-DD` in the *local* offset, not UTC. */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Upload a voice clip and get back a triage verdict plus the live schedule.
 *
 * `targetDate` is a `YYYY-MM-DD` string, defaulting to today - the gateway
 * defaults it too, but sending it explicitly keeps the two agreeing when the
 * booking form already knows which day the patient is looking at.
 *
 * The clip has to be sent again to re-query a different date: the gateway does
 * not cache by patient, so there is no cheaper way to ask "and what about
 * tomorrow?" while preserving the transcription.
 */
export async function sendVoiceScheduleTriage(
  audioBlob: Blob,
  targetDate?: string,
): Promise<VoiceScheduleTriageResponse> {
  const form = new FormData();
  // The filename is what the gateway's upload validator keys on; the extension
  // is derived from the blob's own MIME type so a Safari `audio/mp4` recording
  // does not get named `.webm`.
  const extension = audioBlob.type.split(";")[0].trim().toLowerCase();
  const name = extension === "audio/mp4" ? "voice_record.m4a" : "voice_record.webm";
  form.append("file", audioBlob, name);

  let payload: VoiceScheduleTriageResponse;
  try {
    const response = await triageApi.post<VoiceScheduleTriageResponse>(
      triagePath("/voice-schedule"),
      form,
      { params: { target_date: targetDate ?? todayIso() } },
    );
    payload = response.data;
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error;

    const status = error.response?.status;
    const detail = detailOf(error.response?.data);

    // 400: Whisper found no speech in the clip. A loud click or a door closing
    // gets here too, so the wording has to invite a retry without implying the
    // microphone is broken.
    if (status === 400) {
      throw new VoiceTriageError(
        detail || "Không nhận diện được giọng nói trong đoạn ghi âm.",
        "silent",
        status,
      );
    }
    // 503: the schedule database is unreachable. The LLM half already ran, so
    // this is a partial success the UI must be able to render rather than a
    // blanket failure - `partial` carries whatever triage managed to complete.
    if (status === 503) {
      throw new VoiceTriageError(
        detail ||
          "Hệ thống lịch khám đang tạm không truy cập được. Vui lòng chọn khung giờ thủ công.",
        "no_schedule",
        status,
        partialTriage(error.response?.data),
      );
    }
    if (error.code === "ECONNABORTED") {
      throw new VoiceTriageError(
        "Phân tích giọng nói quá thời gian chờ. Vui lòng thử lại.",
        "timeout",
        status,
      );
    }
    throw new VoiceTriageError(
      status
        ? `Máy chủ phân tích giọng nói trả về lỗi ${status}.`
        : "Không thể kết nối tới máy chủ phân tích giọng nói.",
      status ? "server" : "network",
      status,
    );
  }

  if (!payload?.success) {
    throw new VoiceTriageError(
      detailOf(payload) || "Máy chủ không trả về kết quả phân loại hợp lệ.",
      "server",
    );
  }

  return payload;
}
