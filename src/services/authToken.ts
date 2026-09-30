import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { PATIENT_PROFILE_FIELDS } from "../types/auth";
import type { PatientProfileFields } from "../types/auth";

/**
 * Where the signed-in session lives.
 *
 * Kept in its own module (rather than inside AuthProvider) because the axios
 * interceptor has to reach the token from outside React: it must not close over
 * component state, or the very first request after `login()` would go out
 * unauthenticated and a second tab would disagree about the session.
 */
export const AUTH_STORAGE_KEY = "clinic_auth_user";

const USER_ROLES = [
  "PATIENT",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "PHARMACIST",
  "ADMIN",
] as const;

/** Instances already carrying the interceptor, so it is only added once. */
const instrumented = new WeakSet<AxiosInstance>();

/**
 * The bearer token of the current session, or `null` when nobody is signed in.
 *
 * Read on every request rather than cached, so a `logout()` in another tab (or a
 * re-login) takes effect immediately.
 */
export function readStoredToken(): string | null {
  const session = readStorage();
  return typeof session?.token === "string" && session.token.length > 0
    ? session.token
    : null;
}

/**
 * True when the persisted entry is a session we can still act on: it carries a
 * JWT and a role the UI knows about. A stored object written by an older build
 * fails this and is treated as signed out rather than triggering doomed calls.
 */
export function isUsableStoredSession(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const { token, role } = value as StoredSession;
  if (typeof token !== "string" || token.length === 0) return false;
  return USER_ROLES.includes(role as (typeof USER_ROLES)[number]);
}

export function readStoredSession(): unknown {
  return readStorage();
}

/**
 * The patient profile / BHYT fields saved on the previous visit.
 *
 * AuthService has no columns for these, so a fresh `login` or `/me` response
 * cannot carry them and would otherwise wipe a card the patient just saved.
 * Only the whitelisted keys are copied - see `PATIENT_PROFILE_FIELDS` - and a
 * stored entry without a usable session yields `{}` rather than resurrecting a
 * signed-out patient's data.
 */
export function readStoredProfileFields(): Partial<PatientProfileFields> {
  const stored = readStorage();
  if (!isUsableStoredSession(stored)) return {};
  const source = stored as Record<string, unknown>;
  const fields: Partial<PatientProfileFields> = {};
  for (const key of PATIENT_PROFILE_FIELDS) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      (fields as Record<string, unknown>)[key] = value;
    } else if (typeof value === "boolean") {
      (fields as Record<string, unknown>)[key] = value;
    }
  }
  return fields;
}

export function persistSession(value: unknown): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // A full or blocked localStorage must not turn a successful login into an
    // error; the session simply will not survive a reload.
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Nothing to do - there is no fallback store left behind.
  }
}

/**
 * Attach `Authorization: Bearer <token>` to every request made through
 * `instance`.
 *
 * Requests that already carry an Authorization header are left untouched, so
 * `getMyProfileApi(token)` can pin an explicit token. Safe to call repeatedly:
 * a second call on the same instance is a no-op.
 */
export function attachBearerInterceptor(instance: AxiosInstance): void {
  if (instrumented.has(instance)) return;
  instrumented.add(instance);
  instance.interceptors.request.use(addAuthorizationHeader);
}

function addAuthorizationHeader(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  const token = readStoredToken();
  if (!token) return config;
  if (config.headers.Authorization) return config;
  config.headers.Authorization = `Bearer ${token}`;
  return config;
}

function readStorage(): StoredSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as StoredSession)
      : null;
  } catch {
    // Private-mode Safari and a corrupted entry both land here; "cannot tell"
    // has to read as signed out.
    return null;
  }
}

interface StoredSession {
  token?: unknown;
  role?: unknown;
}
