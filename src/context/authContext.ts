import { createContext } from "react";
import type {
  LoginCredentials,
  LoginExtraContext,
  RegisterPayload,
  User,
  UserRole,
} from "../types/auth";

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  /**
   * `extraContext` carries the khoa picked on the login screen; the staff
   * directory match on `email` takes precedence over it.
   */
  login: (
    credentials: LoginCredentials,
    role: UserRole,
    extraContext?: LoginExtraContext,
  ) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);