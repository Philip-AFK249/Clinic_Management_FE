import axios from "axios";
import { attachBearerInterceptor } from "../../../services/authToken";

/**
 * Typed HTTP client for the DoctorScheduleService (Spring Boot at
 * http://localhost:8081). All requests go through the Vite dev proxy
 * (/api -> http://localhost:8081) to avoid CORS issues in development.
 */
export const scheduleApi = axios.create({
  baseURL: "/api/v1/schedules",
  headers: { "Content-Type": "application/json" },
  timeout: 4000,
});

attachBearerInterceptor(scheduleApi);

export type ShiftSession = "MORNING" | "AFTERNOON";

/** The clinic runs outpatient consultations only. */
export type DutyType = "OUTPATIENT";

export interface Department {
  id: number;
  code: string;
  name: string;
}

export interface Doctor {
  id: number;
  fullName: string;
  title: string;
  roomNumber: string;
  active: boolean;
}

export interface DoctorReference {
  id: number;
  fullName: string;
  title: string;
  roomNumber: string;
}

export interface DoctorShift {
  id: number;
  doctor: DoctorReference;
  departmentId: number;
  departmentName: string;
  shiftDate: string; // YYYY-MM-DD
  session: ShiftSession;
  dutyType: DutyType;
  maxPatientsPerSlot: number;
  roomNumber?: string;
  /**
   * Paired Y tá / Thư ký y khoa. Optional because the column is nullable and a
   * shift created before the pairing landed comes back without one; `nurseName`
   * is back-filled department-side when the column is null, so consumers render
   * `nurseName ?? "Chưa phân Y tá"`.
   */
  nurseId?: number | null;
  nurseName?: string | null;
}

export interface TimeSlotResponse {
  startTime: string; // "HH:mm:ss"
  endTime: string; // "HH:mm:ss"
  totalCapacity: number;
  bookedCount: number;
  availableCapacity: number;
  /** Always filled in by `getAvailableSlots`' normalisation. */
  isAvailable: boolean;
  /**
   * The raw alias some service builds emit instead of `isAvailable`; kept on
   * the shape so a slot rendered straight from a hand-built payload can still
   * be told apart from a closed one.
   */
  available?: boolean;
}

/**
 * What DoctorScheduleService's `/available-slots` actually serializes.
 *
 * Lombok's `boolean isAvailable` getter makes Jackson emit either `available`
 * or `isAvailable` depending on the compiler/lombok version, so both keys are
 * accepted and normalised by `getAvailableSlots`. Older builds send neither
 * when the slot is open, leaving only the capacity columns - hence the
 * capacity fallback in `normalizeSlot`.
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

export interface CreateShiftPayload {
  doctorId: number;
  departmentId: number;
  shiftDate: string; // YYYY-MM-DD
  session: ShiftSession;
  dutyType: DutyType;
  /**
   * Optional pairing with a Y tá / Thư ký y khoa. Omit both to let the service
   * fall back to its per-block default; send them to pin a specific person.
   */
  nurseId?: number | null;
  nurseName?: string | null;
}

/**
 * Patch payload for `PUT /shifts/{id}`. DoctorScheduleService's
 * `updateShift` only writes the fields it receives (a `null`/missing field is
 * skipped), so the modal sends every edited value and leaves the pairing out
 * when the admin picks "-- Để mặc định theo Khối --" - the service cannot
 * un-assign a Y tá / Thư ký y khoa who is already stored.
 */
export interface UpdateShiftPayload {
  doctorId?: number;
  departmentId?: number;
  shiftDate?: string; // YYYY-MM-DD
  session?: ShiftSession;
  dutyType?: DutyType;
  maxPatientsPerSlot?: number;
  nurseId?: number;
  nurseName?: string;
}

export class ScheduleApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ScheduleApiError";
    this.status = status;
  }
}

function firstNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Spring Boot's validation failures put the useful text in
 * `errors[].defaultMessage`; `message` is only a generic summary such as
 * "Validation failed for object='createShiftRequest'. Error count: 1".
 */
function extractValidationMessage(
  record: Record<string, unknown>,
): string | undefined {
  const errors = record.errors;
  if (!Array.isArray(errors)) return undefined;
  for (const entry of errors) {
    if (typeof entry === "string") {
      const message = firstNonEmptyString(entry);
      if (message) return message;
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const errorRecord = entry as Record<string, unknown>;
    const message =
      firstNonEmptyString(errorRecord.defaultMessage) ??
      firstNonEmptyString(errorRecord.message);
    if (message) return message;
  }
  return undefined;
}

/**
 * Spring's default summaries are useless to an admin; treat them as absent so
 * the caller falls through to a readable Vietnamese message.
 */
function isSpringValidationSummary(message: string): boolean {
  return (
    /validation failed for object=/i.test(message) ||
    /error count:\s*\d+/i.test(message)
  );
}

/**
 * Normalize any error (network failure, HTTP error, unexpected) into a
 * renderable Vietnamese message, keeping the `any` free.
 */
function toErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const data = error.response.data as unknown;
      if (typeof data === "string" && data.trim()) {
        const text = data.trim();
        if (!isSpringValidationSummary(text)) return text;
      }
      if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;
        const validationMessage = extractValidationMessage(record);
        if (validationMessage) return validationMessage;
        const message = firstNonEmptyString(record.message);
        if (message && !isSpringValidationSummary(message)) return message;
      }
      if (error.response.status === 409) {
        return "Ca trực đã tồn tại cho khung giờ này. Vui lòng chọn Bác sĩ / khung khác.";
      }
      if (error.response.status === 400) {
        return "Dữ liệu phân ca không hợp lệ. Vui lòng kiểm tra lại thông tin.";
      }
      if (error.response.status === 404) {
        return "Endpoint của DoctorScheduleService không tồn tại. Vui lòng kiểm tra phiên bản backend.";
      }
      if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;
        const fallback =
          firstNonEmptyString(record.error) ?? firstNonEmptyString(record.message);
        if (fallback && !isSpringValidationSummary(fallback)) return fallback;
      }
    }
    if (error.code === "ECONNABORTED") {
      return "Máy chủ DoctorScheduleService phản hồi quá chậm (timeout 15s). Vui lòng thử lại.";
    }
    if (error.code === "ERR_NETWORK") {
      return "Không kết nối được DoctorScheduleService. Vui lòng kiểm tra backend (Spring Boot @ :8081) đã khởi động.";
    }
    return error.message || "Đã xảy ra lỗi mạng khi gọi DoctorScheduleService.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Đã xảy ra lỗi không xác định.";
}

function toApiError(error: unknown): ScheduleApiError {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  return new ScheduleApiError(toErrorMessage(error), status);
}

/**
 * Older backend rows may still carry the legacy duty value. The frontend no
 * longer has a second duty mode, so every shift is presented as an outpatient
 * examination
 * shift - including when an old row is edited and saved back.
 */
function asOutpatientShift(shift: DoctorShift): DoctorShift {
  return { ...shift, dutyType: "OUTPATIENT" };
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function getDepartments(signal?: AbortSignal): Promise<Department[]> {
  try {
    const { data } = await scheduleApi.get<Department[]>("/departments", {
      signal,
    });
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

export async function getDoctors(
  departmentId: number | string,
  signal?: AbortSignal,
): Promise<Doctor[]> {
  try {
    const { data } = await scheduleApi.get<Doctor[]>("/doctors", {
      params: { departmentId },
      signal,
    });
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export async function getShifts(
  departmentId: number | string,
  shiftDate: string,
  signal?: AbortSignal,
): Promise<DoctorShift[]> {
  try {
    const { data } = await scheduleApi.get<DoctorShift[]>("/shifts", {
      params: { departmentId, date: shiftDate },
      signal,
    });
    return data.map(asOutpatientShift);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

export async function getWeeklyShifts(
  departmentId: number | string,
  startDate: string,
  endDate: string,
  signal?: AbortSignal,
): Promise<DoctorShift[]> {
  try {
    const { data } = await scheduleApi.get<DoctorShift[]>("/shifts/weekly", {
      params: { departmentId, startDate, endDate },
      signal,
    });
    return data.map(asOutpatientShift);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

export async function createShift(
  payload: CreateShiftPayload,
  signal?: AbortSignal,
): Promise<DoctorShift> {
  try {
    const { data } = await scheduleApi.post<DoctorShift>("/shifts", payload, {
      signal,
    });
    return asOutpatientShift(data);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

export async function updateShift(
  shiftId: number,
  payload: UpdateShiftPayload,
  signal?: AbortSignal,
): Promise<DoctorShift> {
  try {
    const { data } = await scheduleApi.put<DoctorShift>(
      `/shifts/${shiftId}`,
      payload,
      { signal },
    );
    return asOutpatientShift(data);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

export async function deleteShift(
  shiftId: number,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await scheduleApi.delete(`/shifts/${shiftId}`, { signal });
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Compliance validation + slot monitoring
// ---------------------------------------------------------------------------

export async function validateRoster(
  departmentId: number | string,
  shiftDate: string,
  session: ShiftSession,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const { data } = await scheduleApi.get<boolean>("/roster/validate", {
      params: { departmentId, date: shiftDate, session },
      signal,
    });
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * Today's slot grid for one department, always with a definite
 * `isAvailable`.
 *
 * The raw payload is normalised rather than passed through: a slot whose JSON
 * carries `available` instead of `isAvailable` (or neither, on older builds)
 * would otherwise render as "Đã khóa / Hết chỗ" on the monitor even though
 * `availableCapacity > 0` says there is room to receive patients.
 */
export async function getAvailableSlots(
  departmentId: number | string,
  shiftDate: string,
  signal?: AbortSignal,
): Promise<TimeSlotResponse[]> {
  try {
    const { data } = await scheduleApi.get<RawTimeSlotResponse[]>(
      "/available-slots",
      { params: { departmentId, date: shiftDate }, signal },
    );
    return data.map(normalizeSlot);
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

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