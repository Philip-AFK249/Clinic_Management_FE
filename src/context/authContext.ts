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
  /**
   * Merge a patch into the signed-in user and re-persist the session.
   *
   * This is how /patient/profile saves: AuthService has no columns for the
   * profile and BHYT fields, so the update is local to the stored session.
   */
  updateUser: (patch: Partial<User>) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);