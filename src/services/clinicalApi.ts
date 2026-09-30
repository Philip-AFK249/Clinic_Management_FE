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
      "/clinical/encounters/start",
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
      `/clinical/encounters/${encounterId}/complete`,
      payload,
      { signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
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
      "/pharmacy/prescriptions",
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
      `/pharmacy/prescriptions/${prescriptionId}`,
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
      `/pharmacy/prescriptions/${prescriptionId}/dispense`,
      undefined,
      { params: { pharmacistId, pharmacistName }, signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/** Active formulary used by the doctor's prescribing table. */
export async function getActiveDrugsApi(signal?: AbortSignal): Promise<DrugDto[]> {
  try {
    const { data } = await clinicalApi.get<RawDrugResponse[]>("/pharmacy/drugs", {
      signal,
    });
    return data.map(normalizeDrug);
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
