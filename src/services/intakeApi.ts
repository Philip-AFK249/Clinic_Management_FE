import axios from "axios";
import { attachBearerInterceptor } from "./authToken";

/**
 * Typed HTTP client for the PatientIntakeService (Spring Boot at
 * http://localhost:8082). All requests go through the Vite dev proxy
 * (/api/v1/intake and /api/v1/queue -> :8082) to avoid CORS issues.
 *
 * The service fans out to the DoctorScheduleService (:8081) to resolve
 * load-balanced 60-minute slots and to auto-assign the least-busy doctor,
 * so a failed doctor assignment surfaces as a 500 on /check-in.
 */
export const intakeApi = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 6000,
});

// Carries the AuthService JWT when signed in, so the intake service can bind
// the record to a real account instead of an anonymous kiosk session.
attachBearerInterceptor(intakeApi);

// ---------------------------------------------------------------------------
// Enums (mirroring the Java enums, all serialized as plain uppercase strings)
// ---------------------------------------------------------------------------

/** P1 = emergency, P2 = needs to be seen soon, P3 = routine. */
export type TriagePriority = "P1" | "P2" | "P3";

export type QueueStatus =
  | "WAITING"
  | "CALLED"
  | "IN_CONSULTATION"
  | "COMPLETED"
  | "SKIPPED"
  | "CANCELLED";

export type IntakeSource =
  | "KIOSK_OCR"
  | "KIOSK_QR"
  | "RECEPTION_MANUAL"
  | "ONLINE_BOOKING";

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/**
 * Wire shape of a slot as returned by PatientIntakeService. Lombok generates
 * `isAvailable()` for the `boolean isAvailable` field, so Jackson can emit
 * either `available` or `isAvailable` depending on the compiler/lombok
 * version. Both keys are accepted and normalised by `getAvailableSlots`.
 */
interface RawTimeSlotResponse {
  startTime: string; // "HH:mm:ss"
  endTime: string; // "HH:mm:ss"
  totalCapacity: number;
  bookedCount: number;
  availableCapacity: number;
  available?: boolean;
  isAvailable?: boolean;
}

export interface TimeSlotResponse {
  startTime: string; // "HH:mm:ss"
  endTime: string; // "HH:mm:ss"
  totalCapacity: number;
  bookedCount: number;
  availableCapacity: number;
  isAvailable: boolean;
}

export interface AdministrativeIntakeRequest {
  fullName: string; // @NotBlank
  identityCardNumber?: string;
  insuranceCode?: string;
  initialHospitalCode?: string;
  dateOfBirth?: string; // "yyyy-MM-dd"
  gender?: string; // free-form String, max 10 chars in DB
  phone?: string;
  address?: string;
  isOcrVerified?: boolean;
  departmentId: number; // @NotNull
  departmentName: string; // @NotBlank
  appointmentDate: string; // "yyyy-MM-dd", @NotNull
  slotStartTime: string; // "HH:mm:ss", @NotNull
  priorityLevel: TriagePriority; // @NotNull
  intakeSource: IntakeSource; // @NotNull
  chiefComplaint?: string;
}

export interface IntakeResponse {
  ticketNumber: string; // e.g. "#A-001" (includes the literal "#")
  patientId: number;
  patientName: string;
  insuranceCode: string | null;
  departmentId: number;
  departmentName: string;
  doctorId: number;
  doctorName: string;
  roomNumber: string; // e.g. "Phòng 101"
  appointmentDate: string;
  slotStartTime: string;
  priorityLevel: TriagePriority;
  checkInTime: string; // "yyyy-MM-dd'T'HH:mm:ss"
  message: string;
}

export interface IntakePatient {
  id: number;
  fullName: string;
  identityCardNumber: string | null;
  insuranceCode: string | null;
  initialHospitalCode: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  isOcrVerified: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * The queue endpoints serialise the JPA entity directly, so the patient comes
 * back as a nested object rather than flattened onto the ticket.
 */
export interface QueueTicket {
  id: number;
  ticketNumber: string; // "#A-001"
  patient: IntakePatient;
  departmentId: number;
  departmentName: string;
  doctorId: number;
  doctorName: string;
  roomNumber: string;
  appointmentDate: string;
  slotStartTime: string; // "HH:mm:ss"
  priorityLevel: TriagePriority;
  intakeSource: IntakeSource;
  status: QueueStatus;
  chiefComplaint: string | null;
  checkInTime: string | null;
  calledAt: string | null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Why a request failed, so the UI can react differently per cause. */
export type IntakeFailureKind =
  /** No HTTP response at all: service down, DNS/CORS, or connection refused. */
  | "offline"
  /** Client-side cancellation (AbortController). */
  | "cancelled"
  /** The service answered with 4xx. */
  | "request"
  /** The service answered with 5xx: it is up but failing. */
  | "server";

export class IntakeApiError extends Error {
  readonly status?: number;
  readonly kind: IntakeFailureKind;

  constructor(message: string, kind: IntakeFailureKind, status?: number) {
    super(message);
    this.name = "IntakeApiError";
    this.kind = kind;
    this.status = status;
  }

  /** True when the service could not be reached (as opposed to erroring). */
  get isOffline(): boolean {
    return this.kind === "offline";
  }
}

const FAILURE_KIND_BY_STATUS: Record<number, IntakeFailureKind> = {
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
        const record = data as Record<string, unknown>;
        // Spring's default error body carries `error` ("Internal Server Error")
        // and no `message`; that string is not worth showing to a receptionist.
        const message = typeof record.message === "string" ? record.message : undefined;
        if (message) return message;
      }
      if (FAILURE_KIND_BY_STATUS[status]) {
        if (status === 400) {
          return "Dữ liệu tiếp nhận không hợp lệ. Vui lòng kiểm tra lại các trường bắt buộc.";
        }
        if (status === 404) {
          return "Endpoint của PatientIntakeService không tồn tại. Vui lòng kiểm tra phiên bản backend.";
        }
        if (status === 409) {
          return "Yêu cầu bị xung đột với dữ liệu hiện có. Vui lòng tải lại trang rồi thử lại.";
        }
        return `PatientIntakeService từ chối yêu cầu (HTTP ${status}).`;
      }
      return `PatientIntakeService đã phản hồi lỗi (HTTP ${status}). Dữ liệu có thể chưa được lưu.`;
    }
    if (error.code === "ECONNABORTED") {
      return "Máy chủ PatientIntakeService phản hồi quá chậm. Vui lòng thử lại.";
    }
    if (error.code === "ERR_NETWORK") {
      return "Không kết nối được PatientIntakeService. Vui lòng kiểm tra backend (Spring Boot @ :8082) đã khởi động.";
    }
    return error.message || "Đã xảy ra lỗi mạng khi gọi PatientIntakeService.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Đã xảy ra lỗi không xác định.";
}

function toApiError(error: unknown): IntakeApiError {
  if (!axios.isAxiosError(error)) {
    return new IntakeApiError(toErrorMessage(error), "request");
  }
  const status = error.response?.status;
  if (status === undefined) {
    return new IntakeApiError(toErrorMessage(error), "offline");
  }
  return new IntakeApiError(
    toErrorMessage(error),
    FAILURE_KIND_BY_STATUS[status] ?? "server",
    status,
  );
}

// ---------------------------------------------------------------------------
// Intake endpoints
// ---------------------------------------------------------------------------

/**
 * Active waiting-room queue for the whole clinic (or one department), as the
 * reception desk sees it. `departmentId` is optional on the wire: omit it to
 * get every department, which is what the monitor's "Tất cả khoa" tab binds.
 */
export async function getReceptionQueue(
  departmentId: number | null,
  date?: string,
  signal?: AbortSignal,
): Promise<QueueTicket[]> {
  try {
    const { data } = await intakeApi.get<QueueTicket[]>("/v1/queue/reception", {
      params: { departmentId: departmentId ?? undefined, date },
      signal,
    });
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * 60-minute slot load balance for a department on a given day, proxied from
 * DoctorScheduleService (:8081).
 */
export async function getAvailableSlots(
  departmentId: number,
  date: string,
  signal?: AbortSignal,
): Promise<TimeSlotResponse[]> {
  try {
    const { data } = await intakeApi.get<RawTimeSlotResponse[]>(
      "/v1/intake/available-slots",
      { params: { departmentId, date }, signal },
    );
    return data.map(normalizeSlot);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/** Dispatch a patient: resolve/create the patient record and issue a ticket. */
export async function checkInPatient(
  payload: AdministrativeIntakeRequest,
  signal?: AbortSignal,
): Promise<IntakeResponse> {
  try {
    const { data } = await intakeApi.post<IntakeResponse>("/v1/intake/check-in", payload, {
      signal,
    });
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Queue endpoints
// ---------------------------------------------------------------------------

/** Active queue for one doctor, ordered P1 -> P2 -> P3 then check-in time. */
export async function getDoctorQueue(
  doctorId: number,
  date?: string,
  signal?: AbortSignal,
): Promise<QueueTicket[]> {
  try {
    const { data } = await intakeApi.get<QueueTicket[]>(`/v1/queue/doctor/${doctorId}`, {
      params: date ? { date } : undefined,
      signal,
    });
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * Promote the head of the waiting list to CALLED. The backend raises a 500
 * (not a 404) when nobody is waiting, so callers should surface the message.
 */
export async function callNextPatient(
  doctorId: number,
  date?: string,
  signal?: AbortSignal,
): Promise<QueueTicket> {
  try {
    const { data } = await intakeApi.post<QueueTicket>(
      `/v1/queue/doctor/${doctorId}/call-next`,
      undefined,
      { params: date ? { date } : undefined, signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * PATCH with no body: `status` is a required query param. Ticket numbers start
 * with "#" so the path segment must be percent-encoded, otherwise the browser
 * treats the remainder of the URL as a fragment.
 */
export async function updateTicketStatus(
  ticketNumber: string,
  status: QueueStatus,
  signal?: AbortSignal,
): Promise<QueueTicket> {
  try {
    const { data } = await intakeApi.patch<QueueTicket>(
      `/v1/queue/tickets/${encodeURIComponent(ticketNumber)}/status`,
      undefined,
      { params: { status }, signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSlot(raw: RawTimeSlotResponse): TimeSlotResponse {
  return {
    startTime: raw.startTime,
    endTime: raw.endTime,
    totalCapacity: raw.totalCapacity,
    bookedCount: raw.bookedCount,
    availableCapacity: raw.availableCapacity,
    isAvailable: raw.isAvailable ?? raw.available ?? raw.availableCapacity > 0,
  };
}

/** The insurance number lives on the nested patient, not on the ticket. */
export function ticketInsuranceCode(ticket: QueueTicket): string | null {
  return ticket.patient?.insuranceCode ?? null;
}

/** Number of patients still ahead of this ticket inside its own department. */
export function patientsAhead(ticket: QueueTicket, allTickets: QueueTicket[]): number {
  const PRIORITY_RANK: Record<TriagePriority, number> = { P1: 0, P2: 1, P3: 2 };
  return allTickets.filter((other) => {
    if (other.departmentId !== ticket.departmentId) return false;
    if (other.ticketNumber === ticket.ticketNumber) return false;
    if (other.status === "CALLED" || other.status === "IN_CONSULTATION") return true;
    if (other.status !== "WAITING") return false;
    return PRIORITY_RANK[other.priorityLevel] < PRIORITY_RANK[ticket.priorityLevel];
  }).length;
}
