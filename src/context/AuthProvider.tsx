import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AuthContext } from "./authContext";
import type {
  LoginCredentials,
  LoginExtraContext,
  RegisterPayload,
  User,
  UserRole,
} from "../types/auth";
import {
  departmentNameOf,
  DOCTOR_DIRECTORY,
  FALLBACK_DEPARTMENT_ID,
  FALLBACK_DOCTOR_ID,
} from "../pages/doctor/data/doctorDirectory";
import {
  FALLBACK_PHARMACIST_ID,
  pharmacistIdFor,
} from "../pages/pharmacy/data/pharmacyDirectory";
import {
  FALLBACK_NURSE,
  nurseFor,
} from "../pages/reception/data/nurseDirectory";

const STORAGE_KEY = "clinic_auth_user";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function findDoctor(email: string) {
  return DOCTOR_DIRECTORY.find(
    (doctor) => doctor.email.toLowerCase() === normalizeEmail(email),
  );
}

/**
 * Turns credentials + the role/khoa chosen on the login screen into the identity
 * that gets persisted. Kept separate from the state updates so `login` and
 * `register` stamp the session identically.
 */
function resolveIdentity(
  email: string,
  role: UserRole,
  extraContext?: LoginExtraContext,
) {
  const doctor = role === "DOCTOR" ? findDoctor(email) : undefined;
  // An unknown doctor email still needs a khoa, so fall back to the card the
  // user picked on the login screen before the backend knows better.
  const departmentId =
    doctor?.departmentId ??
    (role === "NURSE"
      ? (nurseFor(email)?.departmentId ?? FALLBACK_DEPARTMENT_ID)
      : extraContext?.departmentId);

  const fullName =
    role === "PATIENT"
      ? "Nguyễn Văn An"
      : role === "DOCTOR"
        ? (doctor?.fullName ?? "Bác sĩ chưa đăng ký danh mục")
        : role === "NURSE"
          ? (nurseFor(email)?.fullName ?? FALLBACK_NURSE.fullName)
          : role === "RECEPTIONIST"
            ? "Nguyễn Thị Hồng Nhung"
            : role === "PHARMACIST"
              ? "DS. Đặng Thu Thảo"
              : "Quản trị viên Hệ thống";

  return {
    fullName,
    departmentId,
    departmentName:
      role === "DOCTOR" || role === "NURSE"
        ? departmentNameOf(departmentId)
        : undefined,
    // Only doctors are queue-scoped; every other role leaves it undefined.
    doctorId: role === "DOCTOR" ? (doctor?.id ?? FALLBACK_DOCTOR_ID) : undefined,
    pharmacistId:
      role === "PHARMACIST"
        ? (pharmacistIdFor(email) ?? FALLBACK_PHARMACIST_ID)
        : undefined,
  };
}

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function persistUser(user: User): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function clearStoredUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadStoredUser);

  const login = useCallback(
    async (
      credentials: LoginCredentials,
      role: UserRole,
      extraContext?: LoginExtraContext,
    ): Promise<User> => {
      if (!credentials.email || !credentials.password) {
        throw new Error("Email và mật khẩu là bắt buộc.");
      }

      const identity = resolveIdentity(credentials.email, role, extraContext);

      const mockUser: User = {
        id: crypto.randomUUID(),
        email: credentials.email,
        role,
        token: `mock_jwt_${role.toLowerCase()}_${Date.now()}`,
        ...identity,
      };

      setUser(mockUser);
      persistUser(mockUser);
      return mockUser;
    },
    [],
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<User> => {
      if (payload.password !== payload.confirmPassword) {
        throw new Error("Mật khẩu xác nhận không khớp.");
      }

      const identity = resolveIdentity(payload.email, payload.role);

      const mockUser: User = {
        id: crypto.randomUUID(),
        email: payload.email,
        role: payload.role,
        phone: payload.phone,
        token: `mock_jwt_${payload.role.toLowerCase()}_${Date.now()}`,
        ...identity,
        // Self-registration supplies its own name; only the id/department links
        // come from the directory.
        fullName: payload.fullName,
      };

      setUser(mockUser);
      persistUser(mockUser);
      return mockUser;
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    clearStoredUser();
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
    }),
    [user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}