import type { AuthResponseDto } from "../../../services/authApi";
import type { UserRole } from "../../../types/auth";

/** The staff roles this console categorises, mirroring `STAFF_ROLE_FILTERS`. */
export type StaffRole = "DOCTOR" | "PHARMACIST" | "NURSE" | "ADMIN";

export type StaffRoleFilter = "ALL" | StaffRole;

/**
 * The role chips above the table. `PATIENT` is absent because those accounts
 * belong to the patient roster tab, and `RECEPTIONIST` has no chip of its own -
 * such an account is still listed under "Tất cả".
 */
export const STAFF_ROLE_FILTERS: {
  value: StaffRoleFilter;
  label: string;
}[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "DOCTOR", label: "Bác sĩ" },
  { value: "PHARMACIST", label: "Dược sĩ" },
  { value: "NURSE", label: "Điều dưỡng" },
  { value: "ADMIN", label: "Quản trị viên" },
];

export function isStaffRole(role: UserRole): role is StaffRole {
  return (
    role === "DOCTOR" ||
    role === "PHARMACIST" ||
    role === "NURSE" ||
    role === "ADMIN"
  );
}

const ROLE_LABELS: Record<UserRole, string> = {
  PATIENT: "Bệnh nhân",
  DOCTOR: "Bác sĩ",
  PHARMACIST: "Dược sĩ",
  NURSE: "Điều dưỡng",
  RECEPTIONIST: "Tiếp đón viên",
  ADMIN: "Quản trị viên",
};

/** Unknown roles fall through to their raw value rather than rendering blank. */
export function staffRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

export const STAFF_ROLE_BADGE_COLORS: Record<UserRole, string> = {
  PATIENT: "bg-sky-100 text-sky-800 border-sky-200",
  DOCTOR: "bg-teal-100 text-teal-800 border-teal-200",
  PHARMACIST: "bg-emerald-100 text-emerald-800 border-emerald-200",
  NURSE: "bg-violet-100 text-violet-800 border-violet-200",
  RECEPTIONIST: "bg-amber-100 text-amber-800 border-amber-200",
  ADMIN: "bg-slate-100 text-slate-800 border-slate-300",
};

/**
 * The directory endpoint returns every account, so the staff roster keeps only
 * the roles it manages.
 */
export function isStaffAccount(user: AuthResponseDto): boolean {
  return user.role !== "PATIENT";
}

/** Up to two initials for the avatar chip. */
export function staffInitials(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(-2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
  return initials || "NV";
}

/**
 * Only an explicit `active === false` counts as locked: the field is optional on
 * the DTO, so a payload from a pre-`active` jar must not read as "locked".
 */
export function isStaffLocked(staff: AuthResponseDto): boolean {
  return staff.active === false;
}

/**
 * `createdAt` as `dd/MM/yyyy`, or `null` when the column is absent or
 * unparseable - the table shows `--` instead of "Invalid Date".
 */
export function staffCreatedAt(
  createdAt: string | null | undefined,
): string | null {
  if (!createdAt) return null;
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${String(parsed.getDate()).padStart(2, "0")}/${String(
    parsed.getMonth() + 1,
  ).padStart(2, "0")}/${parsed.getFullYear()}`;
}

export function staffRoleCounts(
  staff: AuthResponseDto[],
): Record<StaffRoleFilter, number> {
  const counts: Record<StaffRoleFilter, number> = {
    ALL: staff.length,
    DOCTOR: 0,
    PHARMACIST: 0,
    NURSE: 0,
    ADMIN: 0,
  };
  for (const user of staff) {
    // A RECEPTIONIST account still shows under "Tất cả"; it has no chip of its
    // own, so it must not be counted as one of the four categories.
    if (isStaffRole(user.role)) counts[user.role] += 1;
  }
  return counts;
}

export function matchesStaffSearch(
  staff: AuthResponseDto,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return (
    (staff.fullName ?? "").toLowerCase().includes(needle) ||
    (staff.email ?? "").toLowerCase().includes(needle) ||
    (staff.phone ?? "").toLowerCase().includes(needle) ||
    (staff.departmentName ?? "").toLowerCase().includes(needle)
  );
}

export function filterStaff(
  staff: AuthResponseDto[],
  query: string,
  roleFilter: StaffRoleFilter,
): AuthResponseDto[] {
  return staff.filter(
    (user) =>
      (roleFilter === "ALL" || user.role === roleFilter) &&
      matchesStaffSearch(user, query),
  );
}
