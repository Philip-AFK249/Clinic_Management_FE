import axios from "axios";

/**
 * Typed HTTP client for the DoctorScheduleService (Spring Boot at
 * http://localhost:8081). All requests go through the Vite dev proxy
 * (/api -> http://localhost:8081) to avoid CORS issues in development.
 */
export const scheduleApi = axios.create({
  baseURL: "/api/v1/schedules",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

export type ShiftSession = "MORNING" | "AFTERNOON";

export type DutyType = "OUTPATIENT" | "INPATIENT";

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
  shiftDate: string; // YYYY-MM-DD
  session: ShiftSession;
  dutyType: DutyType;
  maxPatientsPerSlot: number;
}

export interface TimeSlotResponse {
  startTime: string; // "HH:mm:ss"
  endTime: string; // "HH:mm:ss"
  totalCapacity: number;
  bookedCount: number;
  availableCapacity: number;
  isAvailable: boolean;
}

export interface CreateShiftPayload {
  doctorId: number;
  departmentId: number;
  shiftDate: string; // YYYY-MM-DD
  session: ShiftSession;
  dutyType: DutyType;
}

export class ScheduleApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ScheduleApiError";
    this.status = status;
  }
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
        return data;
      }
      if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;
        const message =
          typeof record.message === "string"
            ? record.message
            : typeof record.error === "string"
              ? record.error
              : undefined;
        if (message) return message;
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

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function getDepartments(): Promise<Department[]> {
  try {
    const { data } = await scheduleApi.get<Department[]>("/departments");
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

export async function getDoctors(
  departmentId: number | string,
): Promise<Doctor[]> {
  try {
    const { data } = await scheduleApi.get<Doctor[]>("/doctors", {
      params: { departmentId },
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export async function getShifts(
  departmentId: number | string,
  shiftDate: string,
): Promise<DoctorShift[]> {
  try {
    const { data } = await scheduleApi.get<DoctorShift[]>("/shifts", {
      params: { departmentId, date: shiftDate },
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function createShift(
  payload: CreateShiftPayload,
): Promise<DoctorShift> {
  try {
    const { data } = await scheduleApi.post<DoctorShift>("/shifts", payload);
    return data;
  } catch (error) {
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
): Promise<boolean> {
  try {
    const { data } = await scheduleApi.get<boolean>("/roster/validate", {
      params: { departmentId, date: shiftDate, session },
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function getAvailableSlots(
  departmentId: number | string,
  shiftDate: string,
): Promise<TimeSlotResponse[]> {
  try {
    const { data } = await scheduleApi.get<TimeSlotResponse[]>(
      "/available-slots",
      { params: { departmentId, date: shiftDate } },
    );
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}