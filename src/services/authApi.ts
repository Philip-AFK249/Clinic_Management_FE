import axios from "axios";
import { attachBearerInterceptor } from "./authToken";
import type { UserRole } from "../types/auth";

/**
 * Typed HTTP client for the AuthService (Spring Boot @ http://localhost:8085).
 *
 * Requests go through the Vite dev proxy (`/api/v1/auth` -> :8085) so the
 * browser never issues a cross-origin call, exactly like `clinicalApi` (:8083),
 * `intakeApi` (:8082) and `scheduleApi` (:8081). Set `VITE_AUTH_API_BASE` to
 * `http://localhost:8085/api/v1` to bypass the proxy.
 */
export const AUTH_BASE_URL: string =
  import.meta.env.VITE_AUTH_API_BASE ?? "/api/v1";

export const authApi = axios.create({
  baseURL: AUTH_BASE_URL,
  headers: { "Content-Type": "application/json" },
  // A BCrypt password check plus a DB round trip: 10s leaves room for a cold
  // JVM without letting a hung request pin the login button forever.
  timeout: 10000,
});

// Login/register must not carry a stale token; every other call benefits from
// it. The interceptor skips requests that already set Authorization, so the
// explicit header in getMyProfileApi/createStaffApi wins.
attachBearerInterceptor(authApi);

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/**
 * `AuthService.dto.AuthResponse`.
 *
 * `userId` is the numeric `users.id` PK - there is no UUID on this service, so
 * `User.id` in `types/auth.ts` is a number for every real session.
 *
 * `token` is null for `POST /admin/users`: the account is created but has never
 * signed in, so there is nothing to hand back.
 *
 * Everything below the first block was added with the patient-management
 * upgrade (patient demographics, CCCD, BHYT). They are optional because the
 * jar currently deployed on :8085 predates that change and omits them from the
 * response entirely - see the note on `getAllPatientsApi`.
 */
export interface AuthResponseDto {
  token: string | null;
  userId: number;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: number | null;
  departmentName: string | null;
  doctorId: number | null;
  pharmacistId: number | null;
  phone?: string | null;
  /** False = the account is locked out of sign-in. */
  active?: boolean | null;
  identityCardNumber?: string | null;
  insuranceCode?: string | null;
  initialHospitalCode?: string | null;
  /** `LocalDate`, serialised as `YYYY-MM-DD`. */
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  isOcrVerified?: boolean | null;
  createdAt?: string | null;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

/** Patient self-registration. The backend always forces `role = PATIENT`. */
export interface RegisterPatientRequestDto {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

/** Staff account creation. The backend assigns the password `password123`. */
export interface CreateStaffRequestDto {
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  departmentId?: number;
  departmentName?: string;
  doctorId?: number;
  pharmacistId?: number;
}

/**
 * `AuthService.dto.UpdateStaffRequest` - admin edit of a staff account.
 *
 * `email` is deliberately absent: it is the account identity and AuthService has
 * no endpoint to change it, so the admin console renders it disabled.
 */
export interface UpdateStaffRequestDto {
  fullName: string;
  phone?: string | null;
  role: UserRole;
  departmentId?: number | null;
  departmentName?: string | null;
  doctorId?: number | null;
  pharmacistId?: number | null;
}

/**
 * `AuthService.dto.UpdatePatientRequest` - demographics, CCCD and BHYT.
 *
 * `fullName` is `@NotBlank` server-side, so it is the only required field. The
 * rest are nullable columns: send `null` to clear one, omit it to leave it as-is
 * is NOT possible here because the service overwrites whatever it receives.
 */
export interface UpdatePatientRequestDto {
  fullName: string;
  phone?: string | null;
  identityCardNumber?: string | null;
  insuranceCode?: string | null;
  initialHospitalCode?: string | null;
  /** `LocalDate`, serialised as `YYYY-MM-DD`. */
  dateOfBirth?: string | null;
  /** MALE / FEMALE / OTHER - the column is a free-form varchar. */
  gender?: string | null;
  address?: string | null;
  isOcrVerified?: boolean | null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * How a call failed, for the UI to branch on. Note that AuthService answers
 * **400** for wrong credentials and for invalid/expired tokens, not 401 - it
 * signals both through `IllegalArgumentException`. 401/403 are still mapped so
 * the client keeps working once the service is put behind a gateway that speaks
 * the conventional status codes.
 */
export type AuthFailureKind =
  | "invalid"
  | "unauthorized"
  | "forbidden"
  | "missing"
  | "conflict"
  | "offline"
  | "server";

export class AuthApiError extends Error {
  readonly kind: AuthFailureKind;
  readonly status?: number;

  constructor(message: string, kind: AuthFailureKind, status?: number) {
    super(message);
    this.name = "AuthApiError";
    this.kind = kind;
    this.status = status;
  }
}

const FAILURE_KIND_BY_STATUS: Record<number, AuthFailureKind> = {
  400: "invalid",
  401: "unauthorized",
  403: "forbidden",
  404: "missing",
  409: "conflict",
};

const FALLBACK_MESSAGE: Record<AuthFailureKind, string> = {
  invalid: "Thông tin không hợp lệ. Vui lòng kiểm tra lại.",
  unauthorized: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
  forbidden: "Bạn không có quyền thực hiện thao tác này trên AuthService.",
  missing: "AuthService chưa triển khai thao tác này (HTTP 404).",
  conflict: "Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.",
  offline: "Không kết nối được AuthService. Vui lòng kiểm tra backend (Spring Boot @ :8085) đã khởi động.",
  server: "AuthService đã gặp lỗi. Vui lòng thử lại sau.",
};

/**
 * `GlobalExceptionHandler` answers `{ timestamp, status, error, message }` with a
 * clinician-facing Vietnamese `message`, so a present message always wins. The
 * per-kind fallbacks only cover the cases the service does not describe - most
 * notably Spring's own `@Valid` rejection, which reaches the client as a 400
 * with no `message` field at all.
 */
function toErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const { status } = error.response;
      const kind = FAILURE_KIND_BY_STATUS[status] ?? "server";
      const data = error.response.data as unknown;

      if (typeof data === "string" && data.trim()) return data;
      if (data && typeof data === "object") {
        const message = (data as Record<string, unknown>).message;
        if (typeof message === "string" && message.trim()) return message;
      }
      if (status >= 500) {
        return "AuthService đã gặp lỗi (HTTP 500). Vui lòng thử lại sau.";
      }
      return FALLBACK_MESSAGE[kind];
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return "Máy chủ AuthService phản hồi quá chậm. Vui lòng thử lại.";
    }
    if (error.code === "ERR_NETWORK") {
      return FALLBACK_MESSAGE.offline;
    }
    return error.message || FALLBACK_MESSAGE.offline;
  }
  if (error instanceof Error) return error.message;
  return "Đã xảy ra lỗi không xác định.";
}

function toApiError(error: unknown): AuthApiError {
  if (!axios.isAxiosError(error)) {
    return new AuthApiError(toErrorMessage(error), "server");
  }
  const status = error.response?.status;
  if (status === undefined) {
    return new AuthApiError(toErrorMessage(error), "offline");
  }
  return new AuthApiError(
    toErrorMessage(error),
    FAILURE_KIND_BY_STATUS[status] ?? "server",
    status,
  );
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/**
 * Exchange credentials for a JWT plus the authoritative user context.
 *
 * The returned `role` is the source of truth: the role chips on the login screen
 * are only a convenience, so a mismatch has to be resolved by the caller rather
 * than by trusting what was clicked.
 */
export async function loginApi(
  credentials: LoginRequestDto,
  signal?: AbortSignal,
): Promise<AuthResponseDto> {
  try {
    const { data } = await authApi.post<AuthResponseDto>(
      "/auth/login",
      credentials,
      { signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * Patient self-registration. The response already carries a signed JWT, so the
 * caller can establish a session without a second login round trip.
 *
 * The backend forces `role = PATIENT`; a phone number is mandatory.
 */
export async function registerPatientApi(
  payload: RegisterPatientRequestDto,
  signal?: AbortSignal,
): Promise<AuthResponseDto> {
  try {
    const { data } = await authApi.post<AuthResponseDto>(
      "/auth/register",
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
 * Re-read the session from the JWT. Used on boot to confirm a restored session
 * is still valid and to pick up a role or department changed server-side.
 *
 * AuthService answers **400** ("JWT Token không hợp lệ hoặc đã hết hạn") for a
 * bad token, so callers must treat both 400 and 401 as "sign me out".
 */
export async function getMyProfileApi(
  token: string,
  signal?: AbortSignal,
): Promise<AuthResponseDto> {
  try {
    const { data } = await authApi.get<AuthResponseDto>("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * Create a staff account (doctor, nurse, receptionist, pharmacist, admin).
 *
 * The token is sent because RBAC is the point of the endpoint - but note that
 * the deployed `SecurityConfig` currently marks `/api/v1/auth/**` as
 * `permitAll()`, so the service itself does not enforce it. Until that is fixed,
 * treat this call as an internal admin tool, not a security boundary.
 *
 * The response has `token: null`: the account exists but has not signed in yet.
 */
export async function createStaffApi(
  payload: CreateStaffRequestDto,
  token?: string,
  signal?: AbortSignal,
): Promise<AuthResponseDto> {
  try {
    const { data } = await authApi.post<AuthResponseDto>(
      "/auth/admin/users",
      payload,
      {
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        signal,
      },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * `GET /auth/admin/users` - the staff directory.
 *
 * `token` is optional because the bearer interceptor already stamps the current
 * session on every request; passing one explicitly is only needed to pin a
 * different session.
 *
 * The service returns *every* account, patients included, so callers must filter
 * by role - the admin console splits the same table into a staff roster and a
 * patient roster.
 */
export async function getAllStaffApi(
  token?: string,
  signal?: AbortSignal,
): Promise<AuthResponseDto[]> {
  try {
    const { data } = await authApi.get<AuthResponseDto[]>("/auth/admin/users", {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      signal,
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * `GET /auth/admin/patients` - every PATIENT account with its BHYT / CCCD
 * columns.
 *
 * NOTE: this endpoint exists in the AuthService source but the jar deployed on
 * :8085 was built before it landed, so it currently answers 403. Callers must
 * therefore handle a thrown `AuthApiError` and show an empty state rather than
 * assuming the list is always available.
 */
export async function getAllPatientsApi(
  token: string,
  signal?: AbortSignal,
): Promise<AuthResponseDto[]> {
  try {
    const { data } = await authApi.get<AuthResponseDto[]>("/auth/admin/patients", {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * `PUT /auth/admin/patients/{id}` - admin edit of demographics, CCCD and BHYT.
 *
 * Same deployment caveat as `getAllPatientsApi`.
 */
export async function updatePatientByAdminApi(
  id: number,
  payload: UpdatePatientRequestDto,
  token: string,
  signal?: AbortSignal,
): Promise<AuthResponseDto> {
  try {
    const { data } = await authApi.put<AuthResponseDto>(
      `/auth/admin/patients/${id}`,
      payload,
      { headers: { Authorization: `Bearer ${token}` }, signal },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * `PATCH /auth/admin/users/{id}/toggle-status` - lock / unlock an account.
 *
 * Named for the account, not for a role: the staff roster and the patient roster
 * both drive it with a `users.id`, and `active` is a single column on the entity.
 */
export async function toggleUserStatusApi(
  id: number,
  token?: string,
  signal?: AbortSignal,
): Promise<AuthResponseDto> {
  try {
    const { data } = await authApi.patch<AuthResponseDto>(
      `/auth/admin/users/${id}/toggle-status`,
      null,
      {
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        signal,
      },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * `POST /auth/admin/users/{id}/reset-password` - reset the account password.
 *
 * The restored value is the one `DataInitializer` seeds every account with:
 * `password123`.
 */
export async function resetUserPasswordApi(
  id: number,
  token?: string,
  signal?: AbortSignal,
): Promise<{ message: string }> {
  try {
    const { data } = await authApi.post<{ message: string }>(
      `/auth/admin/users/${id}/reset-password`,
      null,
      {
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        signal,
      },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}

/**
 * `PUT /auth/admin/users/{id}` - admin edit of a staff account (name, phone,
 * role, department).
 *
 * NOTE: this is the staff counterpart of `updatePatientByAdminApi` and mirrors
 * its shape; like that one it is not in the AuthService source shipped so far,
 * so it answers 404 until the endpoint lands. The UI reports the failure rather
 * than pretending the save worked.
 */
export async function updateStaffByAdminApi(
  id: number,
  payload: UpdateStaffRequestDto,
  token?: string,
  signal?: AbortSignal,
): Promise<AuthResponseDto> {
  try {
    const { data } = await authApi.put<AuthResponseDto>(
      `/auth/admin/users/${id}`,
      payload,
      {
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        signal,
      },
    );
    return data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toApiError(error);
  }
}
