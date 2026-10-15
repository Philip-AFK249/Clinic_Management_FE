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
 * Flattened ticket + patient shape returned by `/v1/queue/tickets/{ticketNumber}`
 * and `/v1/queue/patient/{patientId}/active` (the DTO, not the JPA entity), so
 * the patient portal can poll its own ticket without the nested-patient shape.
 * All java.time fields arrive as ISO strings under Spring Boot defaults.
 */
export interface QueueTicketDetailResponse {
  ticketNumber: string; // "#A-001"
  departmentId: number;
  departmentName: string;
  doctorId: number;
  doctorName: string;
  roomNumber: string; // "Phòng 101"
  appointmentDate: string; // "yyyy-MM-dd"
  slotStartTime: string; // "HH:mm:ss"
  priorityLevel: TriagePriority;
  intakeSource: IntakeSource;
  status: QueueStatus;
  chiefComplaint: string | null;
  checkInTime: string | null; // ISO datetime
  calledAt: string | null;
  patientId: number;
  patientFullName: string;
  identityCardNumber: string | null;
  insuranceCode: string | null;
  initialHospitalCode: string | null;
  dateOfBirth: string | null; // "yyyy-MM-dd"
  gender: string | null;
  phone: string | null;
  address: string | null;
  isOcrVerified: boolean | null;
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

/**
 * Full ticket + patient record for one ticket number, as the patient portal
 * reads it back after booking. Ticket numbers start with "#" so the path
 * segment must be percent-encoded (same rule as the status PATCH).
 */
export async function getTicketDetails(
  ticketNumber: string,
  signal?: AbortSignal,
): Promise<QueueTicketDetailResponse> {
  try {
    const { data } = await intakeApi.get<QueueTicketDetailResponse>(
      `/v1/queue/tickets/${encodeURIComponent(ticketNumber)}`,
      { signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * The patient's most recent still-active ticket (WAITING/CALLED/
 * IN_CONSULTATION). The service answers 400 - not 404 - when they have none,
 * which is an expected state rather than a failure; use
 * `isNoActiveTicketError` to tell it apart from a real fault.
 */
export async function getActivePatientTicket(
  patientId: number,
  signal?: AbortSignal,
): Promise<QueueTicketDetailResponse> {
  try {
    const { data } = await intakeApi.get<QueueTicketDetailResponse>(
      `/v1/queue/patient/${patientId}/active`,
      { signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * The same "most recent active ticket" lookup, addressed by patient identifier
 * (phone, CCCD or BHYT number) instead of `Patient.id`.
 *
 * The patient portal must not pass AuthService's `users.id` here: that primary
 * key belongs to a different database and does not correspond to
 * `PatientIntakeService`'s `Patient.id`, so the id-based route answers 400 for
 * a perfectly real patient. The identifier is matched against the intake
 * record's own columns, which the check-in flow populates from the same values
 * the AuthService session holds.
 *
 * A 400 ("no such patient / no active ticket") or 404 (endpoint not deployed)
 * is an ordinary answer for the portal's polling loop - use
 * `isNoActiveTicketError` / `isUnknownTicketError` to treat it as "no ticket"
 * rather than as a fault.
 */
export async function getActivePatientTicketByIdentifier(
  identifier: string,
  signal?: AbortSignal,
): Promise<QueueTicketDetailResponse> {
  try {
    const { data } = await intakeApi.get<QueueTicketDetailResponse>(
      "/v1/queue/patient/active",
      { params: { identifier }, signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * True when the active-ticket lookup said "this patient has no active ticket".
 *
 * The backend raises IllegalArgumentException (-> 400) for that case, so a
 * caller polling on a timer can stop or fall back to the stored ticket instead
 * of surfacing an error toast for a perfectly ordinary "already finished".
 */
export function isNoActiveTicketError(error: unknown): boolean {
  return error instanceof IntakeApiError && error.status === 400;
}

/**
 * What PatientIntakeService actually mints: `#` + one queue letter + a
 * zero-padded sequence, e.g. `#A-001`, `#C-142` (see `generateTicketNumber`
 * in IntakeService; the letter defaults to `K` for unrecognised departments).
 */
export const TICKET_NUMBER_PATTERN = /^#[A-Z]-\d{3,}$/;

/**
 * Whether a stored ticket number could have come from the backend.
 *
 * Legacy UI mocks used the shape `#APT-2026-8821`, which the service rejects
 * with a 400 - so anything that fails the real pattern is treated as garbage
 * on read and purged rather than polled into an endless error loop.
 */
export function isValidTicketNumber(ticketNumber: string): boolean {
  return TICKET_NUMBER_PATTERN.test(ticketNumber);
}

/**
 * True when a ticket lookup said "no such ticket" (400 from the
 * IllegalArgumentException handler, or a 404 route miss).
 *
 * Unlike `isNoActiveTicketError`, this means the *number itself* is unknown to
 * the backend - the signal to stop polling and drop the stored booking.
 */
export function isUnknownTicketError(error: unknown): boolean {
  return (
    error instanceof IntakeApiError &&
    (error.status === 400 || error.status === 404)
  );
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
 * Every waiting ticket for one doctor from today onward - the window a
 * per-date `getDoctorQueue` misses when a ticket was pre-booked for tomorrow
 * while the request is scoped to today (the backend anchors this one at
 * `LocalDate.now()`, so it takes no date param).
 */
export async function getDoctorUpcomingQueue(
  doctorId: number,
  signal?: AbortSignal,
): Promise<QueueTicket[]> {
  try {
    const { data } = await intakeApi.get<QueueTicket[]>(
      `/v1/queue/doctor/${doctorId}/upcoming`,
      { signal },
    );
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
