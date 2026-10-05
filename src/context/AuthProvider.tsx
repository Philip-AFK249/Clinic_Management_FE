import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AuthContext } from "./authContext";
import type {
  LoginCredentials,
  LoginExtraContext,
  RegisterPayload,
  User,
  UserRole,
} from "../types/auth";
import {
  AuthApiError,
  getMyProfileApi,
  loginApi,
  registerPatientApi,
} from "../services/authApi";
import type { AuthResponseDto } from "../services/authApi";
import {
  clearStoredSession,
  isUsableStoredSession,
  persistSession,
  readStoredProfileFields,
  readStoredSession,
} from "../services/authToken";
import {
  departmentNameOf,
  DOCTOR_DIRECTORY,
} from "../pages/doctor/data/doctorDirectory";
import { PHARMACIST_DIRECTORY } from "../pages/pharmacy/data/pharmacyDirectory";
import { NURSE_DIRECTORY } from "../pages/reception/data/nurseDirectory";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function findDoctor(email: string) {
  return DOCTOR_DIRECTORY.find(
    (doctor) => doctor.email.toLowerCase() === normalizeEmail(email),
  );
}

function findPharmacist(email: string) {
  return PHARMACIST_DIRECTORY.find(
    (pharmacist) => pharmacist.email.toLowerCase() === normalizeEmail(email),
  );
}

function findNurse(email: string) {
  return NURSE_DIRECTORY.find(
    (nurse) => nurse.email.toLowerCase() === normalizeEmail(email),
  );
}

/**
 * `AuthResponseDto` -> the `User` the app renders.
 *
 * The backend is authoritative: the ids come straight from its `users` row. The
 * local staff directories are only a safety net for rows created before those
 * columns were populated - a DOCTOR without a `doctorId` would otherwise be
 * silently resolved to another doctor's queue by `resolveDoctorId`.
 */
function toUser(dto: AuthResponseDto, extraContext?: LoginExtraContext): User {
  // Only a doctor may fall back to the khoa picked on the login screen: it is
  // the one role whose department the user chooses before the account is known.
  // Everyone else either has a department in the DB or has no business having
  // one, so a stale picker selection must not leak into their session.
  const departmentId =
    dto.departmentId ??
    (dto.role === "DOCTOR"
      ? (findDoctor(dto.email)?.departmentId ?? extraContext?.departmentId)
      : dto.role === "NURSE"
        ? findNurse(dto.email)?.departmentId
        : undefined);
  const isDepartmentScoped = dto.role === "DOCTOR" || dto.role === "NURSE";

  return {
    // The stored session goes FIRST so the backend overwrites it. It is only a
    // fallback for an AuthService that does not return these columns yet; with
    // it spread last it would win over a real backend value, and a patient who
    // updated their card on another device would sign in here and see the old
    // one - which is exactly what `PUT /auth/me/profile` was added to prevent.
    ...readStoredProfileFields(),
    id: dto.userId,
    email: dto.email,
    fullName: dto.fullName,
    role: dto.role,
    // Only `POST /admin/users` answers with a null token, and that response is
    // never turned into a session.
    token: dto.token ?? "",
    // `null` means the column is unset, and every consumer reads "absent" as
    // `undefined`, so normalise here rather than at each call site.
    phone: dto.phone ?? undefined,
    departmentId: isDepartmentScoped ? departmentId : undefined,
    departmentName: isDepartmentScoped
      ? (dto.departmentName ?? departmentNameOf(departmentId))
      : undefined,
    doctorId:
      dto.doctorId ??
      (dto.role === "DOCTOR" ? findDoctor(dto.email)?.id : undefined),
    pharmacistId:
      dto.pharmacistId ??
      (dto.role === "PHARMACIST" ? findPharmacist(dto.email)?.id : undefined),
    // Demographics, CCCD and BHYT. These were being dropped on the floor, so a
    // freshly registered patient saw only a name and an email on /patient/profile
    // - the phone number they signed up with included.
    identityCardNumber: dto.identityCardNumber ?? undefined,
    insuranceCode: dto.insuranceCode ?? undefined,
    initialHospitalCode: dto.initialHospitalCode ?? undefined,
    dateOfBirth: dto.dateOfBirth ?? undefined,
    gender: dto.gender ?? undefined,
    address: dto.address ?? undefined,
    isOcrVerified: dto.isOcrVerified ?? false,
  };
}

/**
 * A stored session survives a reload only if it still carries a JWT and a role
 * this build understands. Anything else is treated as signed out rather than
 * replayed into a portal that will immediately 401.
 */
function restoreUser(): User | null {
  const stored = readStoredSession();
  return isUsableStoredSession(stored) ? (stored as User) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(restoreUser);

  const commit = useCallback((next: User): User => {
    setUser(next);
    persistSession(next);
    return next;
  }, []);

  /**
   * Re-validate the restored session once on mount.
   *
   * A rejected token (400/401 - AuthService answers 400 for both an invalid and
   * an expired JWT) drops the session. A network failure keeps the cached user
   * instead: the backend being briefly unreachable is not evidence that anyone
   * signed out, and each microservice call re-authorises on its own. Success also
   * refreshes a role or department that changed server-side.
   */
  const bootToken = useRef(user?.token);
  useEffect(() => {
    const token = bootToken.current;
    if (!token) return;
    let cancelled = false;

    void getMyProfileApi(token).then(
      (profile) => {
        if (cancelled) return;
        // `/me` echoes the token back; keep the one we already hold.
        const refreshed = toUser({ ...profile, token: profile.token ?? token });
        setUser(refreshed);
        persistSession(refreshed);
      },
      (cause: unknown) => {
        if (cancelled) return;
        const rejected =
          cause instanceof AuthApiError &&
          (cause.kind === "invalid" || cause.kind === "unauthorized");
        if (!rejected) return;
        setUser(null);
        clearStoredSession();
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (
      credentials: LoginCredentials,
      // Kept for call-site readability: the role chip the user pressed is a
      // guess, and only the caller can act on a mismatch (by re-routing and
      // warning), so it is deliberately not consulted here.
      _role: UserRole,
      extraContext?: LoginExtraContext,
    ): Promise<User> => {
      if (!credentials.email || !credentials.password) {
        throw new Error("Email và mật khẩu là bắt buộc.");
      }

      const dto = await loginApi({
        email: credentials.email.trim(),
        password: credentials.password,
      });

      return commit(toUser(dto, extraContext));
    },
    [commit],
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<User> => {
      if (payload.password !== payload.confirmPassword) {
        throw new Error("Mật khẩu xác nhận không khớp.");
      }
      if (payload.password.length < 6) {
        throw new Error("Mật khẩu phải có tối thiểu 6 ký tự.");
      }

      // `role` is dropped because AuthService forces PATIENT on
      // self-registration, `confirmPassword` has no server counterpart, and
      // `RegisterPatientRequest` has no field for `dateOfBirth`/`gender` - the
      // `users` table has no column for them, so they are collected by the form
      // and dropped here rather than silently posted and ignored.
      const dto = await registerPatientApi({
        fullName: payload.fullName.trim(),
        email: payload.email.trim(),
        phone: payload.phone.trim(),
        password: payload.password,
      });

      return commit(toUser(dto));
    },
    [commit],
  );

  const logout = useCallback(() => {
    setUser(null);
    clearStoredSession();
  }, []);

  /**
   * Apply a self-service edit to the live session.
   *
   * Reads `user` from the closure instead of computing inside the `setUser`
   * updater so the `persistSession` write stays outside React's state updater
   * (which StrictMode is free to call twice). Reuses `commit`, so an edit is
   * persisted exactly the way a login is.
   */
  const updateUser = useCallback(
    (patch: Partial<User>) => {
      if (!user) return;
      commit({ ...user, ...patch });
    },
    [user, commit],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      login,
      register,
      updateUser,
      logout,
    }),
    [user, login, register, updateUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
