import axios from "axios";
import { attachBearerInterceptor } from "./authToken";

/**
 * Typed HTTP client for the ClinicalConsultationService (Spring Boot @
 * http://localhost:8083).
 *
 * All requests go through the Vite dev proxy (`/api/v1/clinical` and
 * `/api/v1/pharmacy` -> :8083) so the browser never issues a cross-origin
 * request, exactly like `intakeApi` (:8082) and `scheduleApi` (:8081). Deploy
 * builds that already route `/api` to the gateway can ignore this; set
 * `VITE_CLINICAL_API_BASE` to `http://localhost:8083/api/v1` to talk to the
 * service directly instead.
 */
export const CLINICAL_BASE_URL: string =
  import.meta.env.VITE_CLINICAL_API_BASE ?? "/api/v1";

export const clinicalApi = axios.create({
  baseURL: CLINICAL_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 8000,
});

// ClinicalConsultationService is the service most likely to grow RBAC on
// encounters and prescriptions, so it receives the AuthService JWT on every call.
attachBearerInterceptor(clinicalApi);

/**
 * Resolve a controller-relative path (`encounters/start`, `pharmacy/drugs`) to the
 * path to request on `clinicalApi`.
 *
 * Whether the `/clinical` segment belongs to `baseURL` or to the endpoint depends
 * on how `VITE_CLINICAL_API_BASE` is configured, and getting it wrong emits a
 * duplicated segment (`/api/v1/clinical/clinical/encounters/...`). So the segment
 * is applied here, in one place, and only when the configured base does not
 * already end with it:
 *
 * - base `/api/v1`            -> `/clinical/encounters/start`
 * - base `/api/v1/clinical`   -> `/clinical/encounters/start`
 * - base `http://host:8083/api/v1` -> `/clinical/encounters/start`
 *
 * Every request therefore resolves to `<base>/clinical/...` exactly once.
 */
function clinicalPath(path: string): string {
  const base = CLINICAL_BASE_URL.replace(/\/+$/, "");
  return base.endsWith("/clinical") ? path : `/clinical${path}`;
}

// ---------------------------------------------------------------------------
// Enums (mirroring the Java enums, all serialized as plain uppercase strings)
// ---------------------------------------------------------------------------

/** Lifecycle of a bệnh án in ClinicalConsultationService. */
export type EncounterStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/** Mirrors `PrescriptionStatus`; `PENDING_DISPENSE` is the pharmacy inbox. */
export type PrescriptionStatus =
  | "PENDING_DISPENSE"
  | "DISPENSING"
  | "DISPENSED"
  | "CANCELLED";

/** Mirrors `BhytCoverage` on the `drugs` table. */
export type BhytCoverage = "BHYT_80" | "BHYT_100" | "SELF_PAY";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface DiagnosisItem {
  icd10Code: string;
  diseaseName: string;
  isPrimary: boolean;
  aiConfidence?: number;
}

export interface PrescriptionItemPayload {
  drugId: number;
  quantity: number;
  routeFrequency?: string;
  duration?: string;
}

export interface StartEncounterPayload {
  ticketNumber: string;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  departmentId: number;
  insuranceCode?: string;
}

export interface CompleteEncounterPayload {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  bloodPressure?: string;
  heartRate?: number;
  temperature?: string;
  spo2?: number;
  diagnoses: DiagnosisItem[];
  prescriptionItems: PrescriptionItemPayload[];
  patientAllergies?: string[];
}

export interface EncounterResponse {
  encounterId: number;
  ticketNumber: string;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  encounterDate: string;
  status: EncounterStatus;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  diagnoses: DiagnosisItem[];
  prescriptionId?: number;
  createdAt: string;
}

/**
 * Read-side shape of one encounter for the admin audit view.
 *
 * The SOAP notes, diagnoses and prescription link are the documented columns of
 * `EncounterResponse`, so they are inherited rather than redeclared. The vitals
 * columns are added as optional: `completeEncounterApi` writes them but the
 * documented read payload omits them, so the audit view renders a vitals row
 * only when the service actually returns one.
 */
export interface PatientEncounterDto extends EncounterResponse {
  bloodPressure?: string | null;
  heartRate?: number | null;
  temperature?: string | null;
  spo2?: number | null;
}

export interface DrugDto {
  id: number;
  code: string;
  name: string;
  concentration: string;
  dosageForm: string;
  stockQuantity: number;
  unitPrice: number;
  bhytCoverage: BhytCoverage;
  isPenicillinClass: boolean;
  active: boolean;
}

export interface PrescriptionItemResponse {
  itemId: number;
  drugId: number;
  drugCode: string;
  drugName: string;
  concentration: string;
  dosageForm: string;
  routeFrequency: string;
  duration: string;
  quantity: number;
  currentStock: number;
  unitPrice: number;
  amount: number;
}

export interface PrescriptionDetailResponse {
  prescriptionId: number;
  encounterId: number;
  ticketNumber: string;
  patientId: number;
  patientName: string;
  insuranceCode?: string;
  doctorId: number;
  doctorName: string;
  pharmacistId?: number;
  pharmacistName?: string;
  status: PrescriptionStatus;
  totalAmount: number;
  insurancePaidAmount: number;
  patientCopayAmount: number;
  createdAt: string;
  dispensedAt?: string;
  items: PrescriptionItemResponse[];
}

/**
 * Wire shape of `GET /pharmacy/drugs`, which serialises the JPA entity
 * directly. The two boolean columns are `Boolean` (not primitive `boolean`),
 * so Lombok emits `getIsPenicillinClass()` / `getIsActive()` and Jackson writes
 * `isPenicillinClass` / `isActive`; the un-prefixed variants are accepted too
 * so a future `boolean` migration cannot silently blank the flags.
 */
interface RawDrugResponse {
  id: number;
  code: string;
  name: string;
  concentration: string;
  dosageForm: string;
  stockQuantity: number;
  unitPrice: number | string;
  bhytCoverage: BhytCoverage;
  isPenicillinClass?: boolean;
  penicillinClass?: boolean;
  active?: boolean;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Why a request failed, so the UI can react differently per cause. */
export type ClinicalFailureKind =
  /** No HTTP response at all: service down, DNS/CORS, or connection refused. */
  | "offline"
  /** Client-side cancellation (AbortController). */
  | "cancelled"
  /** The service answered with 4xx - the payload or the state was rejected. */
  | "request"
  /** The service answered with 5xx: it is up but failing. */
  | "server";

export class ClinicalApiError extends Error {
  readonly status?: number;
  readonly kind: ClinicalFailureKind;

  constructor(message: string, kind: ClinicalFailureKind, status?: number) {
    super(message);
    this.name = "ClinicalApiError";
    this.kind = kind;
    this.status = status;
  }

  /** True when the service could not be reached (as opposed to erroring). */
  get isOffline(): boolean {
    return this.kind === "offline";
  }

  /**
   * 409s from this service are meaningful, not generic: out-of-stock drugs and
   * "already dispensed" both arrive as `IllegalStateException`. The pharmacy
   * surfaces the backend `message` verbatim so the pharmacist can act on it.
   */
  get isConflict(): boolean {
    return this.status === 409;
  }
}

const FAILURE_KIND_BY_STATUS: Record<number, ClinicalFailureKind> = {
  400: "request",
  401: "request",
  403: "request",
  404: "request",
  409: "request",
  422: "request",
};

/**
 * Normalize any error (network failure, HTTP error, unexpected) into a
 * renderable Vietnamese message, keeping the code `any`-free.
 *
 * `GlobalExceptionHandler` answers `{ timestamp, status, error, message }`, and
 * its `message` is written for clinicians ("Không đủ tồn kho để xuất..."), so
 * a present `message` is always preferred over a generic fallback.
 */
function toErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const { status } = error.response;
      const data = error.response.data as unknown;
      if (typeof data === "string" && data.trim()) {
        return data;
      }
      if (data && typeof data === "object") {
        const message = (data as Record<string, unknown>).message;
        if (typeof message === "string" && message.trim()) return message;
      }
      if (FAILURE_KIND_BY_STATUS[status]) {
        if (status === 400) {
          return "Bệnh án không hợp lệ. Vui lòng kiểm tra lại chẩn đoán ICD-10 và các dòng kê thuốc.";
        }
        if (status === 404) {
          return "Không tìm thấy bản ghi trên ClinicalConsultationService. Vui lòng kiểm tra phiên bản backend.";
        }
        if (status === 409) {
          return "Yêu cầu bị xung đột với trạng thái hiện tại. Vui lòng tải lại hàng đợi rồi thử lại.";
        }
        return `ClinicalConsultationService từ chối yêu cầu (HTTP ${status}).`;
      }
      return `ClinicalConsultationService đã phản hồi lỗi (HTTP ${status}). Dữ liệu có thể chưa được lưu.`;
    }
    if (error.code === "ECONNABORTED") {
      return "Máy chủ ClinicalConsultationService phản hồi quá chậm. Vui lòng thử lại.";
    }
    if (error.code === "ERR_NETWORK") {
      return "Không kết nối được ClinicalConsultationService. Vui lòng kiểm tra backend (Spring Boot @ :8083) đã khởi động.";
    }
    return error.message || "Đã xảy ra lỗi mạng khi gọi ClinicalConsultationService.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Đã xảy ra lỗi không xác định.";
}

function toApiError(error: unknown): ClinicalApiError {
  if (!axios.isAxiosError(error)) {
    return new ClinicalApiError(toErrorMessage(error), "request");
  }
  const status = error.response?.status;
  if (status === undefined) {
    return new ClinicalApiError(toErrorMessage(error), "offline");
  }
  return new ClinicalApiError(
    toErrorMessage(error),
    FAILURE_KIND_BY_STATUS[status] ?? "server",
    status,
  );
}

// ---------------------------------------------------------------------------
// Clinical consultation endpoints (bác sĩ)
// ---------------------------------------------------------------------------

/**
 * Open a bệnh án for the patient currently in the consultation room.
 *
 * The service is idempotent per `ticketNumber`: an existing encounter for the
 * same ticket is reused instead of duplicated, so a re-render or a second poll
 * cannot create two open records.
 */
export async function startEncounterApi(
  payload: StartEncounterPayload,
  signal?: AbortSignal,
): Promise<EncounterResponse> {
  try {
    const { data } = await clinicalApi.post<EncounterResponse>(
      clinicalPath("/encounters/start"),
      payload,
      { signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * Sign off the encounter: stores SOAP + vitals + ICD-10 diagnoses, creates the
 * prescription (and pushes it to PENDING_DISPENSE) and completes the ticket.
 *
 * The backend rejects the request with a 400 unless at least one diagnosis is
 * supplied, and refuses a second signature with a 409.
 */
export async function completeEncounterApi(
  encounterId: number,
  payload: CompleteEncounterPayload,
  signal?: AbortSignal,
): Promise<EncounterResponse> {
  try {
    const { data } = await clinicalApi.post<EncounterResponse>(
      clinicalPath(`/encounters/${encounterId}/complete`),
      payload,
      { signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * `GET <base>/clinical/encounters/patient/{patientId}` - every bệnh án recorded
 * for one patient, for the admin console's read-only audit view.
 *
 * `patientId` is a `users.id`, the same identity AuthService hands the admin
 * roster, so no cross-service mapping is needed. ClinicalConsultationService owns
 * these rows: nothing in this module writes to them on the admin's behalf, and the
 * caller must not offer an edit affordance.
 *
 * The service is not documented to guarantee an order, so the modal sorts
 * newest-first to build the timeline.
 */
export async function getPatientEncountersApi(
  patientId: number,
  signal?: AbortSignal,
): Promise<PatientEncounterDto[]> {
  try {
    const { data } = await clinicalApi.get<PatientEncounterDto[]>(
      clinicalPath(`/encounters/patient/${patientId}`),
      { signal },
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Ambient AI Gateway (FastAPI) - thu âm hội thoại & Trợ lý AI Copilot
// ---------------------------------------------------------------------------

/**
 * Base URL of the FastAPI AI Gateway (`uvicorn app.api:app --port 8008`).
 *
 * The ambient endpoints live on the gateway, not on ClinicalConsultationService
 * (:8083), so the browser talks to them on their own origin - exactly like
 * `ocrApi`, `voiceTriageApi` and `aiGatewayAdminApi`, whose CORS is open for
 * the Vite dev ports. Every gateway client in this repo reads the same
 * `VITE_AI_GATEWAY_URL` variable and falls back to port 8008, the port the
 * gateway is actually served on.
 */
export const AI_GATEWAY_BASE_URL: string = (
  import.meta.env.VITE_AI_GATEWAY_URL || "http://localhost:8008"
).replace(/\/+$/, "");

/** Port of the gateway above, read back off the URL so the hint can never drift. */
const AI_GATEWAY_PORT: string = (() => {
  try {
    return new URL(AI_GATEWAY_BASE_URL).port || "8008";
  } catch {
    return "8008";
  }
})();

/** One line telling the doctor how to bring the gateway back up. */
export const AI_GATEWAY_START_HINT: string =
  `Vui lòng kiểm tra dịch vụ FastAPI đã khởi động ` +
  `(uvicorn app.api:app --port ${AI_GATEWAY_PORT}).`;

const AMBIENT_CONSULTATION_PATH = "/api/v1/clinical/ambient-consultation";
const COPILOT_CHAT_PATH = "/api/v1/clinical/copilot-chat";

/**
 * Deliberately its own axios instance rather than `clinicalApi`: a different
 * host, a timeout measured in minutes (Whisper STT plus the clinical LLM) and
 * multipart uploads that must not inherit the JSON default content type.
 */
const ambientGatewayApi = axios.create({
  baseURL: AI_GATEWAY_BASE_URL,
  timeout: 300_000,
});

/** SOAP note as the gateway writes it; the four sections are single words in both conventions. */
export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export type DiarizedSpeaker = "DOCTOR" | "PATIENT" | "OTHER";

/** One diarised utterance of the consultation. */
export interface DiarizedMessage {
  speaker: DiarizedSpeaker;
  text: string;
  /** Seconds from the start of the clip; the gateway may omit them. */
  start_seconds?: number | null;
  end_seconds?: number | null;
  /** Pre-rendered `mm:ss` offset, when the gateway already produced one. */
  time_offset?: string | null;
}

export interface Icd10Suggestion {
  icd10_code: string;
  disease_name: string;
  /** True when the LLM ranks this code as the main diagnosis. */
  is_primary?: boolean;
  /** Confidence in percent, 0-100. */
  ai_confidence?: number | null;
}

/** One line of the AI prescription draft, still keyed by drug *name*. */
export interface PrescriptionDraftItem {
  drug_name: string;
  concentration?: string | null;
  dosage_form?: string | null;
  route_frequency?: string | null;
  duration?: string | null;
  quantity: number;
  /** Stock the gateway saw; the live catalog stays authoritative in the UI. */
  current_stock?: number | null;
  in_stock?: boolean | null;
  bhyt_coverage?: string | null;
}

/**
 * Answer of `POST /api/v1/clinical/ambient-consultation`.
 *
 * The clip itself is never persisted: it travels as one multipart upload and
 * is dropped from memory the moment this response arrives.
 */
export interface AmbientConsultationResponse {
  success: boolean;
  diarized_transcript: DiarizedMessage[];
  soap_note: SoapNote;
  icd10_suggestions: Icd10Suggestion[];
  prescription_draft: PrescriptionDraftItem[];
  /** True when HIV / TB / SJS-class red flags were spotted in the dialogue. */
  has_red_flags: boolean;
  red_flags?: string[] | null;
  summary?: string | null;
  warnings?: string[] | null;
  latency_ms?: number | null;
}

/**
 * Clinical background sent with each copilot turn so the model can refine the
 * record without re-listening to the audio. Open-ended on purpose: the drawer
 * adds whatever the workspace knows (vitals, allergies, past encounters).
 */
export interface AmbientPatientContext {
  patientId?: number | string;
  patientName?: string;
  age?: number;
  gender?: string;
  insuranceCode?: string;
  chiefComplaint?: string;
  allergies?: string[];
  vitals?: Record<string, string | number>;
  pastDiagnoses?: string[];
  departmentId?: number;
  doctorId?: number;
  [key: string]: unknown;
}

export interface CopilotChatRequest {
  message: string;
  currentSoap: SoapNote;
  currentDiagnoses: DiagnosisItem[];
  patientContext: AmbientPatientContext;
}

/** Answer of `POST /api/v1/clinical/copilot-chat`. */
export interface CopilotChatResponse {
  success: boolean;
  reply: string;
  /** Refined sections, present only when the turn actually changed them. */
  soap_note?: SoapNote | null;
  icd10_suggestions?: Icd10Suggestion[] | null;
  prescription_draft?: PrescriptionDraftItem[] | null;
  has_red_flags?: boolean;
  red_flags?: string[] | null;
  /** True when the reply carries a chart update the doctor should accept. */
  requires_chart_update?: boolean;
  latency_ms?: number | null;
}

/** FastAPI error bodies, as in `ocrApi`: a string `detail` or a validation list. */
function gatewayDetailOf(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: unknown };
    return typeof first?.msg === "string" ? first.msg.trim() : "";
  }
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" ? message.trim() : "";
}

function toGatewayError(error: unknown): ClinicalApiError {
  if (!axios.isAxiosError(error)) {
    return new ClinicalApiError(
      error instanceof Error
        ? error.message
        : "Đã xảy ra lỗi không xác định khi gọi AI Gateway.",
      "request",
    );
  }

  const status = error.response?.status;
  const detail = gatewayDetailOf(error.response?.data);

  if (error.code === "ECONNABORTED") {
    return new ClinicalApiError(
      "AI Gateway phản hồi quá chậm (Whisper + phân tích lâm sàng). Vui lòng thử lại.",
      "server",
      status,
    );
  }
  if (status === undefined) {
    return new ClinicalApiError(
      `Không kết nối được AI Gateway (${AI_GATEWAY_BASE_URL}). ${AI_GATEWAY_START_HINT}`,
      "offline",
    );
  }
  if (detail) {
    return new ClinicalApiError(detail, FAILURE_KIND_BY_STATUS[status] ?? "server", status);
  }
  return new ClinicalApiError(
    `AI Gateway phản hồi lỗi (HTTP ${status}).`,
    FAILURE_KIND_BY_STATUS[status] ?? "server",
    status,
  );
}

/** `success: false` is a 200 the gateway still wants treated as a failure. */
function requireGatewaySuccess<T extends { success?: boolean }>(payload: T): T {
  if (payload?.success === false) {
    throw new ClinicalApiError(
      gatewayDetailOf(payload) || "AI Gateway không trả về kết quả hợp lệ.",
      "server",
    );
  }
  return payload;
}

/**
 * Upload the in-memory consultation clip and get back the diarised dialogue,
 * the SOAP note, the ICD-10 suggestions and an in-stock prescription draft.
 *
 * The `Blob` is consumed by this request and nowhere else: it is never turned
 * into an object URL, never written to disk and never kept after the response.
 */
export async function sendAmbientConsultationApi(
  audioBlob: Blob,
  metadata: {
    departmentId: number;
    doctorId?: number;
    patientId?: number;
    allergies?: string;
    patientHistory?: string;
  },
): Promise<AmbientConsultationResponse> {
  const form = new FormData();
  // The extension has to match what was actually recorded: a Safari
  // `audio/mp4` clip named `.webm` decodes nowhere. The field name is fixed by
  // the gateway signature - `audio_file: UploadFile = File(...)` - and a
  // differently named part fails validation with 422 "Field required".
  const subtype = audioBlob.type.split(";")[0].trim().toLowerCase();
  const extension =
    subtype === "audio/mp4"
      ? "m4a"
      : subtype === "audio/wav"
        ? "wav"
        : subtype === "audio/ogg"
          ? "ogg"
          : "webm";
  form.append("audio_file", audioBlob, `consultation.${extension}`);
  form.append("department_id", String(metadata.departmentId));
  if (metadata.doctorId !== undefined) {
    form.append("doctor_id", String(metadata.doctorId));
  }
  if (metadata.patientId !== undefined) {
    form.append("patient_id", String(metadata.patientId));
  }
  // Sent even when empty: the gateway declares them as plain strings, and an
  // absent part would 422 if the route ever tightens the signature.
  form.append("allergies", metadata.allergies?.trim() ?? "");
  form.append("patient_history", metadata.patientHistory?.trim() ?? "");

  try {
    // No Content-Type by hand: axios has to append the multipart boundary.
    const { data } = await ambientGatewayApi.post<AmbientConsultationResponse>(
      AMBIENT_CONSULTATION_PATH,
      form,
    );
    return requireGatewaySuccess(data);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    if (error instanceof ClinicalApiError) throw error;
    throw toGatewayError(error);
  }
}

/**
 * One turn of the interactive copilot: the doctor adds history the microphone
 * never heard ("đã nhiễm HIV 2 năm, đang dùng ARV") and the gateway answers
 * with a refined record the doctor can choose to bind back into the EHR.
 */
export async function sendCopilotChatApi(
  payload: CopilotChatRequest,
): Promise<CopilotChatResponse> {
  try {
    const { data } = await ambientGatewayApi.post<CopilotChatResponse>(COPILOT_CHAT_PATH, {
      message: payload.message,
      current_soap: payload.currentSoap,
      current_diagnoses: payload.currentDiagnoses,
      patient_context: payload.patientContext,
    });
    return requireGatewaySuccess(data);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    if (error instanceof ClinicalApiError) throw error;
    throw toGatewayError(error);
  }
}

// ---------------------------------------------------------------------------
// Pharmacy endpoints (dược sĩ)
// ---------------------------------------------------------------------------

/** Dispensing inbox. Defaults to the prescriptions waiting to be handed out. */
export async function getPharmacyQueueApi(
  status: string = "PENDING_DISPENSE",
  signal?: AbortSignal,
): Promise<PrescriptionDetailResponse[]> {
  try {
    const { data } = await clinicalApi.get<PrescriptionDetailResponse[]>(
      clinicalPath("/pharmacy/prescriptions"),
      { params: { status }, signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/** Full detail for one prescription, including live stock per drug line. */
export async function getPrescriptionDetailsApi(
  prescriptionId: number,
  signal?: AbortSignal,
): Promise<PrescriptionDetailResponse> {
  try {
    const { data } = await clinicalApi.get<PrescriptionDetailResponse>(
      clinicalPath(`/pharmacy/prescriptions/${prescriptionId}`),
      { signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * Hand the prescription over to the patient. The service decrements stock
 * line by line and answers 409 when a line is short or the prescription was
 * already dispensed, so the caller must surface `error.message`.
 *
 * Both arguments are query params, not a body - `pharmacistName` is a free-text
 * Vietnamese name and must be encoded by axios.
 */
export async function dispensePrescriptionApi(
  prescriptionId: number,
  pharmacistId: number,
  pharmacistName: string,
  signal?: AbortSignal,
): Promise<PrescriptionDetailResponse> {
  try {
    const { data } = await clinicalApi.post<PrescriptionDetailResponse>(
      clinicalPath(`/pharmacy/prescriptions/${prescriptionId}/dispense`),
      undefined,
      { params: { pharmacistId, pharmacistName }, signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

export type BhytCoverageType = BhytCoverage;

export interface CreateDrugPayload {
  code: string;
  name: string;
  concentration: string;
  dosageForm: string;
  stockQuantity: number;
  unitPrice: number;
  bhytCoverage: BhytCoverageType;
  isPenicillinClass?: boolean;
}

export interface UpdateDrugPayload {
  name: string;
  concentration: string;
  dosageForm: string;
  unitPrice: number;
  stockQuantity: number;
  bhytCoverage: BhytCoverageType;
  isPenicillinClass?: boolean;
  active?: boolean;
}

export interface AdjustStockPayload {
  quantityChange: number;
}

export async function getDrugsApi(signal?: AbortSignal): Promise<DrugDto[]> {
  try {
    const { data } = await clinicalApi.get<RawDrugResponse[]>(clinicalPath("/pharmacy/drugs"), {
      signal,
    });
    return data.map(normalizeDrug);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/** Active formulary used by the doctor's prescribing table. */
export async function getActiveDrugsApi(signal?: AbortSignal): Promise<DrugDto[]> {
  return getDrugsApi(signal);
}

export async function createDrugApi(payload: CreateDrugPayload, signal?: AbortSignal): Promise<DrugDto> {
  try {
    const { data } = await clinicalApi.post<RawDrugResponse>(clinicalPath("/pharmacy/drugs"), payload, {
      signal,
    });
    return normalizeDrug(data);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

export async function updateDrugApi(id: number, payload: UpdateDrugPayload, signal?: AbortSignal): Promise<DrugDto> {
  try {
    const { data } = await clinicalApi.put<RawDrugResponse>(clinicalPath(`/pharmacy/drugs/${id}`), payload, {
      signal,
    });
    return normalizeDrug(data);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

export async function adjustDrugStockApi(id: number, payload: AdjustStockPayload, signal?: AbortSignal): Promise<DrugDto> {
  try {
    const { data } = await clinicalApi.patch<RawDrugResponse>(clinicalPath(`/pharmacy/drugs/${id}/stock`), payload, {
      signal,
    });
    return normalizeDrug(data);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `BigDecimal` arrives as a JSON number today but is free to become a string. */
function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDrug(raw: RawDrugResponse): DrugDto {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    concentration: raw.concentration,
    dosageForm: raw.dosageForm,
    stockQuantity: toNumber(raw.stockQuantity),
    unitPrice: toNumber(raw.unitPrice),
    bhytCoverage: raw.bhytCoverage,
    isPenicillinClass: raw.isPenicillinClass ?? raw.penicillinClass ?? false,
    active: raw.active ?? raw.isActive ?? true,
  };
}
