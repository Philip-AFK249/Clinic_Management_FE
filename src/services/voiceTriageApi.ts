import axios from "axios";

/**
 * Typed HTTP client for the two-stage voice triage endpoint of the FastAPI RAG
 * backend: Whisper transcription followed by a clinical LLM that returns a
 * department, a priority and the live doctor rota.
 *
 * Talks to the backend **directly** rather than through the Vite dev proxy. The
 * proxied path (`/api/v1/triage` -> :8000) answers 502 because the gateway does
 * not listen on 8000, and CORS is open on the server side
 * (`allow_origins=["*"]`), so a cross-origin upload needs no proxy at all.
 */
export const RAG_BASE_URL: string = (
  import.meta.env.VITE_RAG_API_URL || "http://localhost:8086"
).replace(/\/+$/, "");

/**
 * Second place to try, if the first cannot be reached.
 *
 * The gateway runs on 8086 by default; 8008 is kept as a stand-by for the
 * earlier deployment. This is a *connection* fallback, not a retry of a bad
 * request: it is only consulted when nothing answered at all (or a load
 * balancer did), never when the backend itself rejected the clip.
 */
export const RAG_FALLBACK_URL: string = (
  import.meta.env.VITE_RAG_FALLBACK_URL || "http://localhost:8008"
).replace(/\/+$/, "");

/** Endpoint path, relative to whichever base is in use. */
const TRIAGE_PATH = "/api/v1/triage/voice-schedule";

export const ragApi = axios.create({
  baseURL: RAG_BASE_URL,
  // Two model round-trips plus a schedule lookup. A 20-second answer is normal;
  // a shorter timeout would abort a slow-but-working consultation halfway and
  // lose the transcription with it.
  timeout: 120000,
});

/** The port the primary base listens on, for a message that names it. */
function primaryPort(): string {
  try {
    return new URL(RAG_BASE_URL).port || "8086";
  } catch {
    return "8086";
  }
}

/** The connection-failure wording the patient is expected to see. */
const CONNECT_FAILED_MESSAGE = `Không thể kết nối đến máy chủ AI (Port ${primaryPort()}). Vui lòng kiểm tra RAG Backend.`;

// ---------------------------------------------------------------------------
// DTOs - mirror the backend's `VoiceScheduleTriageResponse` Pydantic model.
// ---------------------------------------------------------------------------

/**
 * How badly the patient needs to be seen, as the clinical LLM classified them.
 *
 * `P1` is not a stylistic choice: it means the LLM read the description as a
 * possible emergency (acute coronary syndrome, anaphylaxis, ...), and the UI has
 * to interrupt the booking to say so.
 */
export type TriagePriorityLevel = "P1" | "P2" | "P3";

/**
 * Which half of the day the dispatcher should prefer.
 *
 * `MANUAL_PICK` is the gateway saying it deliberately has no preference - used
 * when the schedule came back usable but nothing in it stood out. The UI treats
 * it as "highlight nothing" rather than as a failure.
 */
export type RecommendedShift =
  | "MORNING"
  | "AFTERNOON"
  | "NEXT_DAY"
  | "NO_DUTY"
  | "MANUAL_PICK";

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
  /** 1: Nội tổng quát, 2: Hô hấp & Dị ứng, 3: Da liễu. */
  department_id: number;
  department_name: string;
  priority_level: TriagePriorityLevel;
  recommended_shift: RecommendedShift;
  advice: string;
  /**
   * The rota for each half of the day.
   *
   * Keys are lower-case and nullable - either can come back `null` when that
   * session has no data at all, which is distinct from "has data but is full".
   */
  schedule: {
    morning?: SessionSchedule | null;
    afternoon?: SessionSchedule | null;
  };
  /**
   * False when `clinic_management_doctorschedule_service` did not answer.
   *
   * This is the case that has to degrade rather than fail: the clinical half of
   * the answer (department, priority, advice) is complete and correct, so it is
   * still worth showing - only the shift picker has to be replaced by a notice.
   */
  schedule_connected: boolean;
  schedule_error?: string;
  target_date: string;
  warnings?: string[];
  latency_ms?: number;
}

/**
 * Why a triage call failed, so the caller can react rather than show one generic
 * message.
 *
 * - `silent`   the clip held no speech - worth asking again, nothing is wrong
 * - `timeout`  two model calls did not finish in time
 * - `network`  the gateway could not be reached at all
 * - `server`   the gateway answered with an error it owns
 */
export type VoiceTriageErrorKind = "silent" | "timeout" | "network" | "server";

export class VoiceTriageError extends Error {
  readonly kind: VoiceTriageErrorKind;
  readonly status?: number;
  /**
   * The gateway's own `detail`, kept for diagnostics.
   *
   * Deliberately not used as the displayed message: a failed recognition tends to
   * come back as English text (`"No speech found in audio"`), and that is worse
   * for a patient than the fixed Vietnamese wording this error already carries.
   */
  readonly detail?: string;

  constructor(
    message: string,
    kind: VoiceTriageErrorKind,
    status?: number,
    detail?: string,
  ) {
    super(message);
    this.name = "VoiceTriageError";
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
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

/**
 * Turn a transport failure into the message the patient should read.
 *
 * The two conditions the spec calls out are deliberately worded differently:
 * a 400 means *your clip* was unusable and is fixed by speaking again, while a
 * 502/network failure means *the service* is down and talking louder will not
 * help. Collapsing them into one apology sends people re-recording into a server
 * that is not listening.
 */
function classify(error: unknown): VoiceTriageError {
  if (!axios.isAxiosError(error)) {
    return new VoiceTriageError(
      "Không phân tích được đoạn ghi âm. Vui lòng thử lại.",
      "server",
      undefined,
      error instanceof Error ? error.message : undefined,
    );
  }

  const status = error.response?.status;
  const detail = detailOf(error.response?.data);

  // 400: the recogniser rejected the clip - silence, a slam, pure tone.
  if (status === 400) {
    return new VoiceTriageError(
      "Không phát hiện âm thanh triệu chứng rõ ràng. Vui lòng nói to hơn vào micro.",
      "silent",
      status,
      detail || undefined,
    );
  }

  // A timeout ends with no response either - check it before the network branch
  // so a slow model round-trip is not misreported as a dead server.
  if (error.code === "ECONNABORTED") {
    return new VoiceTriageError(
      "Phân tích giọng nói quá thời gian chờ. Vui lòng thử lại.",
      "timeout",
      status,
      detail || undefined,
    );
  }

  // 502/504, a refused socket, DNS failure: nothing usable answered.
  if (status === 502 || status === 504 || !error.response) {
    return new VoiceTriageError(CONNECT_FAILED_MESSAGE, "network", status, detail || undefined);
  }

  return new VoiceTriageError(
    status ? `Máy chủ AI trả về lỗi ${status}.` : CONNECT_FAILED_MESSAGE,
    status ? "server" : "network",
    status,
    detail || undefined,
  );
}

/**
 * True when retrying against a different host could actually help.
 *
 * Connection-level failures and gateway errors (`502`/`503`/`504`) qualify; a
 * `400` does not, because the same clip would be rejected by the second host for
 * the same reason and the patient would just see the error twice.
 */
function isRetryable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return !error.response || status === 502 || status === 503 || status === 504;
}

/**
 * Upload a voice clip and get back a triage verdict plus the live schedule.
 *
 * `targetDate` is a `YYYY-MM-DD` string and is sent only when provided: the
 * backend defaults it itself, so omitting it preserves its own default (today in
 * `Asia/Ho_Chi_Minh`) rather than assuming the browser's clock agrees with it.
 *
 * It rides in the multipart body, not the query string: the endpoint declares it
 * as `target_date: Optional[str] = Form(None)`, and FastAPI ignores a query
 * parameter for a `Form` field - so a query-string date was silently discarded
 * and every request was answered for *today*.
 *
 * The clip has to be sent again to re-query a different date - the gateway caches
 * nothing by patient, so there is no cheaper way to ask "what about tomorrow?"
 * while keeping the transcription.
 */
export async function sendVoiceScheduleTriage(
  audioBlob: Blob,
  targetDate?: string,
): Promise<VoiceScheduleTriageResponse> {
  /**
   * Built per attempt: reusing one `FormData` across two requests is only safe
   * while the underlying blob is untouched, and it costs nothing to be sure.
   */
  function body(): FormData {
    const form = new FormData();
    // The filename is what the upload validator keys on, and the extension has to
    // match what was actually recorded - a Safari `audio/mp4` clip named `.webm`
    // decodes nowhere.
    const subtype = audioBlob.type.split(";")[0].trim().toLowerCase();
    const extension =
      subtype === "audio/mp4"
        ? "m4a"
        : subtype === "audio/wav"
          ? "wav"
          : subtype === "audio/ogg"
            ? "ogg"
            : "webm";
    form.append("file", audioBlob, `voice_record.${extension}`);
    if (targetDate) form.append("target_date", targetDate);
    return form;
  }

  async function post(base: string): Promise<VoiceScheduleTriageResponse> {
    const response = await axios.post<VoiceScheduleTriageResponse>(
      `${base}${TRIAGE_PATH}`,
      body(),
      { timeout: 120000 },
    );
    return response.data;
  }

  let firstError: unknown;
  try {
    const payload = await post(RAG_BASE_URL);
    return requireSuccess(payload);
  } catch (error) {
    firstError = error;
  }

  // Primary unreachable - fall back to the standby port before giving up.
  if (
    RAG_FALLBACK_URL &&
    RAG_FALLBACK_URL !== RAG_BASE_URL &&
    isRetryable(firstError)
  ) {
    try {
      return requireSuccess(await post(RAG_FALLBACK_URL));
    } catch {
      // Report the primary failure: the fallback being down too is the same
      // symptom as the primary being down, and the first message is the one
      // most likely to name a port that actually exists.
      throw classify(firstError);
    }
  }

  throw classify(firstError);
}

/** `success: false` is a 200 the gateway still wants treated as a failure. */
function requireSuccess(payload: VoiceScheduleTriageResponse): VoiceScheduleTriageResponse {
  if (!payload?.success) {
    throw new VoiceTriageError(
      detailOf(payload) || "Máy chủ không trả về kết quả phân loại hợp lệ.",
      "server",
      undefined,
      detailOf(payload) || undefined,
    );
  }
  return payload;
}

/**
 * Look up one half of the rota, translating the session name to its key.
 *
 * The payload stores `MORNING`/`AFTERNOON` on the enum but lower-cases the same
 * word as the object key, so `schedule[session]` silently reads `undefined`.
 * Keeping the one place that crosses the two conventions means no caller has to
 * remember it - and it is all-or-nothing, so a future casing change is one edit.
 */
export function sessionScheduleFor(
  triage: VoiceScheduleTriageResponse,
  session: SessionName,
): SessionSchedule | null {
  const value =
    session === "MORNING" ? triage.schedule.morning : triage.schedule.afternoon;
  return value ?? null;
}
