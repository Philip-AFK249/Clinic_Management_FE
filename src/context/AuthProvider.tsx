import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AuthContext } from "./authContext";
import type { LoginCredentials, RegisterPayload, User, UserRole } from "../types/auth";

const STORAGE_KEY = "clinic_auth_user";

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
            ? "PGS. TS. BS. Trần Minh Tuấn"
            : role === "RECEPTIONIST"
              ? "Nguyễn Thị Hồng Nhung"
              : role === "PHARMACIST"
                ? "DS. Đặng Thu Thảo"
                : "Quản trị viên Hệ thống",
        role,
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