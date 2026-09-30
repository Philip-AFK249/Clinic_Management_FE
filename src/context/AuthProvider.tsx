import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AuthContext } from "./authContext";
import type { LoginCredentials, RegisterPayload, User, UserRole } from "../types/auth";
import {
  DOCTOR_DIRECTORY,
  FALLBACK_DOCTOR_ID,
} from "../pages/doctor/data/doctorDirectory";
import {
  FALLBACK_PHARMACIST_ID,
  pharmacistIdFor,
} from "../pages/pharmacy/data/pharmacyDirectory";

const STORAGE_KEY = "clinic_auth_user";

/**
 * Links a doctor account to its `doctors` row so the EHR can scope queue
 * requests without re-deriving the id from the email on every render.
 */
function doctorIdFor(email: string): number | undefined {
  return DOCTOR_DIRECTORY.find(
    (doctor) => doctor.email.toLowerCase() === email.trim().toLowerCase(),
  )?.id;
}

/** Falls back to the seeded display name when the account is a known doctor. */
function doctorNameFor(email: string, fallback: string): string {
  return (
    DOCTOR_DIRECTORY.find(
      (doctor) => doctor.email.toLowerCase() === email.trim().toLowerCase(),
    )?.fullName ?? fallback
  );
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
    async (credentials: LoginCredentials, role: UserRole): Promise<User> => {
      if (!credentials.email || !credentials.password) {
        throw new Error("Email và mật khẩu là bắt buộc.");
      }

      const mockUser: User = {
        id: crypto.randomUUID(),
        email: credentials.email,
        fullName: role === "PATIENT"
          ? "Nguyễn Văn An"
          : role === "DOCTOR"
            ? doctorNameFor(credentials.email, "Bác sĩ chưa đăng ký danh mục")
            : role === "RECEPTIONIST"
              ? "Nguyễn Thị Hồng Nhung"
              : role === "PHARMACIST"
                ? "DS. Đặng Thu Thảo"
                : "Quản trị viên Hệ thống",
        role,
        // Only doctors are queue-scoped; every other role leaves it undefined.
        doctorId: role === "DOCTOR" ? doctorIdFor(credentials.email) : undefined,
        pharmacistId:
          role === "PHARMACIST"
            ? (pharmacistIdFor(credentials.email) ?? FALLBACK_PHARMACIST_ID)
            : undefined,
        token: `mock_jwt_${role.toLowerCase()}_${Date.now()}`,
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

      const mockUser: User = {
        id: crypto.randomUUID(),
        email: payload.email,
        fullName: payload.fullName,
        role: payload.role,
        phone: payload.phone,
        doctorId:
          payload.role === "DOCTOR"
            ? (doctorIdFor(payload.email) ?? FALLBACK_DOCTOR_ID)
            : undefined,
        pharmacistId:
          payload.role === "PHARMACIST"
            ? (pharmacistIdFor(payload.email) ?? FALLBACK_PHARMACIST_ID)
            : undefined,
        token: `mock_jwt_${payload.role.toLowerCase()}_${Date.now()}`,
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