import type { UserRole } from "../../../types/auth";
import type { AuthResponseDto } from "../../../services/authApi";
import {
  CLINICAL_DEPARTMENTS,
  departmentNameOf,
  DOCTOR_DIRECTORY,
} from "../../doctor/data/doctorDirectory";
import { NURSE_DIRECTORY } from "../../reception/data/nurseDirectory";
import { pharmacistIdFor } from "../../pharmacy/data/pharmacyDirectory";

/**
 * Quick-login roster behind the "Chọn nhân sự đăng nhập nhanh" picker.
 *
 * The live source is `GET /api/v1/auth/staff-directory` (AuthService :8085),
 * which is the authoritative list of *active* staff accounts. That payload only
 * carries identity + role + khoa, so every column a picker needs to show a
 * usable row (academic title, phòng / bàn trực) is joined in from the local
 * directories seeded to match `DataInitializer`. When the service is down the
 * roster below is used verbatim, so the login screen never loses its picker.
 *
 * Lives as a `.ts` data module on purpose: `react-refresh/only-export-components`
 * forbids non-component exports from `.tsx` files.
 */
export interface StaffRosterEntry {
  email: string;
  fullName: string;
  role: UserRole;
  /** Academic rank shown under the name, e.g. "BS.CKI". */
  title?: string;
  /** Phòng / quầy / bàn trực shown next to the name. */
  roomNumber?: string;
  departmentId?: number;
  departmentName?: string;
  /** Only on DOCTOR entries: the `doctors.id` the queue is scoped by. */
  doctorId?: number;
  /** Only on PHARMACIST entries, when the local directory knows it. */
  pharmacistId?: number;
}

/**
 * The pharmacist roster used for display only. `pharmacists.id` is deliberately
 * not guessed here: `pharmacyDirectory` stays the single source for it, so the
 * picker cannot stamp a wrong id on a dispensed prescription.
 */
const PHARMACIST_STAFF: StaffRosterEntry[] = [
  { email: "thao.dang@smartclinic.vn", fullName: "DS. Đặng Thu Thảo", role: "PHARMACIST", title: "DS", roomNumber: "Quầy Dược Lâm Sàng #1" },
  { email: "kien.nguyen@smartclinic.vn", fullName: "DS. Nguyễn Trung Kiên", role: "PHARMACIST", title: "DS", roomNumber: "Quầy Dược Lâm Sàng #2" },
  { email: "ha.tran@smartclinic.vn", fullName: "DSCĐ. Trần Thanh Hà", role: "PHARMACIST", title: "DSCĐ", roomNumber: "Cửa phát thuốc BHYT #1" },
  { email: "long.le@smartclinic.vn", fullName: "DSCĐ. Lê Hoàng Long", role: "PHARMACIST", title: "DSCĐ", roomNumber: "Cửa phát thuốc BHYT #2" },
  { email: "phuc.do@smartclinic.vn", fullName: "DSCĐ. Đỗ Hồng Phúc", role: "PHARMACIST", title: "DSCĐ", roomNumber: "Cửa phát thuốc Thu phí #1" },
  { email: "nhung.vu@smartclinic.vn", fullName: "DSCĐ. Vũ Cẩm Nhung", role: "PHARMACIST", title: "DSCĐ", roomNumber: "Cửa phát thuốc Thu phí #2" },
];

/** The two accounts AuthService seeds outside a clinical khoa. */
const NON_CLINICAL_STAFF: StaffRosterEntry[] = [
  {
    email: "reception@clinic.vn",
    fullName: "Nguyễn Thị Hồng Nhung",
    role: "RECEPTIONIST",
    title: "Lễ tân",
    roomNumber: "Quầy Tiếp đón Sảnh A",
  },
  {
    email: "admin@smartclinic.vn",
    fullName: "Quản trị viên Hệ thống",
    role: "ADMIN",
    title: "Quản trị",
    roomNumber: "Phòng Quản trị & CNTT",
  },
];

/** Every staff account, in picker order: Bác sĩ -> Điều dưỡng -> ... -> Admin. */
export const LOCAL_STAFF_ROSTER: StaffRosterEntry[] = [
  ...DOCTOR_DIRECTORY.map((doctor) => ({
    email: doctor.email,
    fullName: doctor.fullName,
    role: "DOCTOR" as const,
    title: doctor.title,
    roomNumber: doctor.roomNumber,
    departmentId: doctor.departmentId,
    departmentName: doctor.departmentName,
    doctorId: doctor.id,
  })),
  ...NURSE_DIRECTORY.map((nurse) => ({
    email: nurse.email,
    fullName: nurse.fullName,
    role: "NURSE" as const,
    title: nurse.title,
    roomNumber: nurse.roomNumber,
    departmentId: nurse.departmentId,
    departmentName: departmentNameOf(nurse.departmentId),
  })),
  ...PHARMACIST_STAFF,
  ...NON_CLINICAL_STAFF,
];

const LOCAL_BY_EMAIL = new Map(
  LOCAL_STAFF_ROSTER.map((entry) => [entry.email.toLowerCase(), entry]),
);

const STAFF_ROLES: UserRole[] = [
  "DOCTOR",
  "NURSE",
  "PHARMACIST",
  "RECEPTIONIST",
  "ADMIN",
];

/**
 * `GET /auth/staff-directory` rows -> picker entries.
 *
 * The backend row wins on identity, role and khoa; everything it does not
 * carry is taken from the local roster so a live directory and the offline one
 * render the same rows. Accounts the local seed does not know (created from
 * the admin console) still show up, just without a title / phòng.
 */
export function mergeStaffDirectory(rows: AuthResponseDto[]): StaffRosterEntry[] {
  const live = rows
    .filter((row) => STAFF_ROLES.includes(row.role))
    .filter((row) => row.active === undefined || row.active === true)
    .map<StaffRosterEntry>((row) => {
      const local = LOCAL_BY_EMAIL.get(row.email.trim().toLowerCase());
      const departmentId = row.departmentId ?? local?.departmentId;
      return {
        email: row.email,
        fullName: row.fullName || local?.fullName || row.email,
        role: row.role,
        title: local?.title,
        roomNumber: local?.roomNumber,
        departmentId,
        departmentName:
          row.departmentName ??
          local?.departmentName ??
          (departmentId !== undefined ? departmentNameOf(departmentId) : undefined),
        doctorId: row.doctorId ?? local?.doctorId,
        pharmacistId: row.pharmacistId ?? pharmacistIdFor(row.email),
      };
    });

  return live.length > 0 ? live : LOCAL_STAFF_ROSTER;
}

function matches(entry: StaffRosterEntry, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  return [
    entry.fullName,
    entry.email,
    entry.title ?? "",
    entry.roomNumber ?? "",
    entry.departmentName ?? "",
  ].some((value) => value.toLowerCase().includes(needle));
}

/** One dropdown group: a role, narrowed to a khoa when the roster splits that way. */
export interface StaffRosterSection {
  key: string;
  label: string;
  caption: string;
  role: UserRole;
  entries: StaffRosterEntry[];
}

/**
 * Group the roster for the dropdown: doctors and nurses are split by khoa (the
 * way the clinic staffs them), the single-account roles stay in one group each.
 *
 * `activeRole`'s sections come first so tapping a role chip narrows the picker
 * to what that chip is about, and the remaining roles stay reachable below it.
 */
export function staffRosterSections(
  roster: StaffRosterEntry[],
  query: string,
  activeRole: UserRole,
): StaffRosterSection[] {
  const sections: StaffRosterSection[] = [];

  for (const department of CLINICAL_DEPARTMENTS) {
    sections.push({
      key: `DOCTOR-${department.id}`,
      label: "Bác sĩ",
      caption: department.name,
      role: "DOCTOR",
      entries: roster.filter(
        (entry) =>
          entry.role === "DOCTOR" &&
          entry.departmentId === department.id &&
          matches(entry, query),
      ),
    });
    sections.push({
      key: `NURSE-${department.id}`,
      label: "Điều dưỡng",
      caption: department.name,
      role: "NURSE",
      entries: roster.filter(
        (entry) =>
          entry.role === "NURSE" &&
          entry.departmentId === department.id &&
          matches(entry, query),
      ),
    });
  }

  for (const role of ["PHARMACIST", "RECEPTIONIST", "ADMIN"] as const) {
    const entries = roster.filter(
      (entry) => entry.role === role && matches(entry, query),
    );
    if (entries.length === 0) continue;
    sections.push({
      key: role,
      label: roleLabelOf(role),
      caption:
        role === "PHARMACIST"
          ? "Duyệt đơn & cấp phát thuốc"
          : role === "RECEPTIONIST"
            ? "Quầy tiếp đón & cấp số"
            : "Quản trị hệ thống",
      role,
      entries,
    });
  }

  const nonEmpty = sections.filter((section) => section.entries.length > 0);
  return [
    ...nonEmpty.filter((section) => section.role === activeRole),
    ...nonEmpty.filter((section) => section.role !== activeRole),
  ];
}

function roleLabelOf(role: UserRole): string {
  switch (role) {
    case "DOCTOR":
      return "Bác sĩ";
    case "NURSE":
      return "Điều dưỡng";
    case "PHARMACIST":
      return "Dược sĩ";
    case "RECEPTIONIST":
      return "Tiếp đón viên";
    case "ADMIN":
      return "Quản trị viên";
    default:
      return "Bệnh nhân";
  }
}

/** "PGS. TS. BS. Trần Minh Tuấn" -> "TM", never empty (avatar stays sized). */
export function staffInitials(fullName: string): string {
  const words = fullName
    .replace(/^(?:PGS|GS|TS|ThS|BS|CKI|CKII|CII|DS|DSCĐ|ĐD|NV)\.?\s+/gi, "")
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");
  return letters.join("") || "NV";
}
