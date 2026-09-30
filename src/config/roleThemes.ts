import type { UserRole } from "../types/auth";

export interface RoleTheme {
  heroBg: string;
  chipActive: string;
  button: string;
  focusClasses: string;
  badge: string;
  portalLabel: string;
}

export const ROLE_THEMES: Record<UserRole, RoleTheme> = {
  PATIENT: {
    heroBg: "bg-clinical-600",
    chipActive: "bg-sky-600 text-white shadow-sm border-transparent",
    button: "bg-sky-600 hover:bg-sky-700",
    focusClasses: "focus:ring-sky-500/20 focus:border-sky-600",
    badge: "bg-sky-100 text-sky-800 border-sky-200",
    portalLabel: "Cổng Bệnh nhân",
  },
  DOCTOR: {
    heroBg: "bg-teal-700",
    chipActive: "bg-teal-600 text-white shadow-sm border-transparent",
    button: "bg-teal-600 hover:bg-teal-700",
    focusClasses: "focus:ring-teal-500/20 focus:border-teal-600",
    badge: "bg-teal-100 text-teal-800 border-teal-200",
    portalLabel: "Bác sĩ (EHR)",
  },
  NURSE: {
    heroBg: "bg-violet-700",
    chipActive: "bg-violet-600 text-white shadow-sm border-transparent",
    button: "bg-violet-600 hover:bg-violet-700",
    focusClasses: "focus:ring-violet-500/20 focus:border-violet-600",
    badge: "bg-violet-100 text-violet-800 border-violet-200",
    portalLabel: "Điều Dưỡng Lâm Sàng",
  },
  RECEPTIONIST: {
    heroBg: "bg-clinical-700",
    chipActive: "bg-clinical-600 text-white shadow-sm border-transparent",
    button: "bg-clinical-600 hover:bg-clinical-700",
    focusClasses: "focus:ring-clinical-500/20 focus:border-clinical-600",
    badge: "bg-clinical-100 text-clinical-800 border-clinical-200",
    portalLabel: "Quầy Tiếp Đón",
  },
  PHARMACIST: {
    heroBg: "bg-emerald-700",
    chipActive: "bg-emerald-600 text-white shadow-sm border-transparent",
    button: "bg-emerald-600 hover:bg-emerald-700",
    focusClasses: "focus:ring-emerald-500/20 focus:border-emerald-600",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    portalLabel: "Quầy Dược",
  },
  ADMIN: {
    heroBg: "bg-slate-800",
    chipActive: "bg-slate-800 text-white shadow-sm border-transparent",
    button: "bg-slate-800 hover:bg-slate-900",
    focusClasses: "focus:ring-slate-500/20 focus:border-slate-700",
    badge: "bg-slate-100 text-slate-800 border-slate-300",
    portalLabel: "Quản trị viên",
  },
};

export interface AuthOutletContext {
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  theme: RoleTheme;
}

/** Display order of the role picker on the login screen. */
export const ROLE_ORDER: UserRole[] = [
  "PATIENT",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "PHARMACIST",
  "ADMIN",
];

/**
 * Chip label + emoji per role. Exhaustive over `UserRole` so a new role cannot
 * ship without a picker entry.
 */
export const ROLE_LABELS: Record<UserRole, { label: string; emoji: string }> = {
  PATIENT: { label: "Bệnh nhân", emoji: "🧑‍🦽" },
  DOCTOR: { label: "Bác sĩ", emoji: "🩺" },
  NURSE: { label: "Điều dưỡng", emoji: "💉" },
  RECEPTIONIST: { label: "Tiếp đón viên", emoji: "🏢" },
  PHARMACIST: { label: "Dược sĩ", emoji: "💊" },
  ADMIN: { label: "Quản trị viên", emoji: "🛡️" },
};