import type { User } from "../../../types/auth";

/**
 * Single source of truth for "which doctor am I?".
 *
 * The `doctors` rows are seeded by DoctorScheduleService (:8081) and are the
 * ids PatientIntakeService (:8082) scopes `/v1/queue/doctor/{id}` by. The staff
 * accounts carrying the matching email addresses live in
 * `pages/admin/data/adminMockData.ts` (MOCK_STAFF); the two are joined here so
 * the EHR never has to guess a doctor id from a hardcoded literal.
 */
export interface DoctorProfile {
  /** `doctors.id` in DoctorScheduleService - the queue is scoped by this. */
  id: number;
  fullName: string;
  /** Compact academic rank as stored on the staff account. */
  title: string;
  /** Expanded rank shown under the name in the header. */
  credential: string;
  email: string;
  roomNumber: string;
  departmentName: string;
  /**
   * `departments.id`, required by `POST /clinical/encounters/start` to stamp
   * the bệnh án. Resolved from the session rather than from the active patient
   * so an encounter can still be opened for a patient without a department.
   */
  departmentId: number;
}

/** Displayed when nobody is signed in (standalone demo / kiosk deep-link). */
export const FALLBACK_DOCTOR_ID = 4;

export interface ClinicalDepartment {
  /** `departments.id` - the value stamped on an encounter. */
  id: number;
  name: string;
  /** Compact label for the login-screen khoa cards. */
  shortName: string;
  /** Clinical scope shown as the card sub-caption. */
  specialties: string;
}

/** The three khoa the clinic runs, in `departments.id` order. */
export const CLINICAL_DEPARTMENTS: ClinicalDepartment[] = [
  {
    id: 1,
    name: "Khoa Nội Tổng quát & Tim mạch",
    shortName: "Nội tổng quát & Tim mạch",
    specialties: "Bệnh tim mạch, nội tiết, chuyển hóa",
  },
  {
    id: 2,
    name: "Khoa Hô hấp & Dị ứng - Miễn dịch lâm sàng",
    shortName: "Hô hấp & Dị ứng",
    specialties: "Hen suyễn, viêm mũi họng, dị ứng, TMH",
  },
  {
    id: 3,
    name: "Khoa Da liễu",
    shortName: "Da liễu",
    specialties: "Viêm da cơ địa, mẩn ngứa, dị ứng tiếp xúc",
  },
];

const DEPARTMENT_BY_ID = new Map(
  CLINICAL_DEPARTMENTS.map((department) => [department.id, department]),
);

/** Used when an encounter or account references a khoa outside the registry. */
export const FALLBACK_DEPARTMENT_ID = CLINICAL_DEPARTMENTS[0].id;

export function departmentNameOf(departmentId: number | undefined): string {
  if (departmentId === undefined) return "Chuyên khoa";
  return DEPARTMENT_BY_ID.get(departmentId)?.name ?? "Chuyên khoa";
}

interface SeededDoctor extends Omit<DoctorProfile, "departmentName"> {
  departmentId: number;
}

/** Mirrors the eight `doctors` seed rows, in `doctors.id` order. */
const SEEDED_DOCTORS: SeededDoctor[] = [
  {
    id: 1,
    fullName: "PGS. TS. BS. Trần Minh Tuấn",
    title: "PGS.TS",
    credential: "Phó Giáo sư, Tiến sĩ Y khoa",
    email: "tuan.tran@smartclinic.vn",
    roomNumber: "Phòng 101",
    departmentId: 1,
  },
  {
    id: 2,
    fullName: "BS. CKI. Nguyễn Văn Dũng",
    title: "BS.CKI",
    credential: "Bác sĩ Chuyên khoa I",
    email: "dung.nguyen@smartclinic.vn",
    roomNumber: "Phòng 102",
    departmentId: 1,
  },
  {
    id: 3,
    fullName: "ThS. BS. Phạm Quốc Bảo",
    title: "ThS.BS",
    credential: "Thạc sĩ Y khoa",
    email: "bao.pham@smartclinic.vn",
    roomNumber: "Phòng 101",
    departmentId: 1,
  },
  {
    id: 4,
    fullName: "BS. CKI. Lê Thị Hoàng Yến",
    title: "BS.CKI",
    credential: "Bác sĩ Chuyên khoa I",
    email: "yen.le@smartclinic.vn",
    roomNumber: "Phòng 201",
    departmentId: 2,
  },
  {
    id: 5,
    fullName: "BS. CKII. Phạm Thị Hoa",
    title: "BS.CKII",
    credential: "Bác sĩ Chuyên khoa II",
    email: "hoa.pham@smartclinic.vn",
    roomNumber: "Phòng 202",
    departmentId: 2,
  },
  {
    id: 6,
    fullName: "ThS. BS. Hoàng Hoài Nam",
    title: "ThS.BS",
    credential: "Thạc sĩ Y khoa",
    email: "nam.hoang@smartclinic.vn",
    roomNumber: "Phòng 201",
    departmentId: 2,
  },
  {
    id: 7,
    fullName: "BS. CKI. Nguyễn Thị Lan",
    title: "BS.CKI",
    credential: "Bác sĩ Chuyên khoa I",
    email: "lan.nguyen@smartclinic.vn",
    roomNumber: "Phòng 205",
    departmentId: 3,
  },
  {
    id: 8,
    fullName: "ThS. BS. Vũ Minh Đức",
    title: "ThS.BS",
    credential: "Thạc sĩ Y khoa",
    email: "duc.vu@smartclinic.vn",
    roomNumber: "Phòng 206",
    departmentId: 3,
  },
];

export const DOCTOR_DIRECTORY: DoctorProfile[] = SEEDED_DOCTORS.map((doctor) => ({
  ...doctor,
  departmentName: departmentNameOf(doctor.departmentId),
}));

/** Roster rows of one khoa, in `doctors.id` order - drives the staff picker. */
export function doctorsOfDepartment(departmentId: number): DoctorProfile[] {
  return DOCTOR_DIRECTORY.filter(
    (doctor) => doctor.departmentId === departmentId,
  );
}

const DOCTOR_BY_ID = new Map(DOCTOR_DIRECTORY.map((doctor) => [doctor.id, doctor]));

const DOCTOR_ID_BY_EMAIL = new Map(
  DOCTOR_DIRECTORY.map((doctor) => [doctor.email.toLowerCase(), doctor.id]),
);

/**
 * Academic rank tokens that prefix a stored `fullName`, in the combinations
 * the roster actually uses: "PGS. TS. BS.", "BS. CKI.", "BS. CKII.", "ThS. BS.".
 * A title is a run of tokens each followed by a dot and whitespace, so a real
 * name word is never swallowed.
 */
const RANK_TOKENS = ["PGS", "GS", "TS", "ThS", "BS", "CKI", "CKII", "CII"];
const TITLE_PREFIX_PATTERN = new RegExp(
  `^(?:(?:${RANK_TOKENS.join("|")})\\.?\\s+)+`,
);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Resolves the queue-scoped doctor id for a signed-in user.
 *
 * Order of precedence:
 *  1. `user.doctorId` - set by the real auth backend when it links an account
 *     to a `doctors` row.
 *  2. the email directory above.
 *  3. `FALLBACK_DOCTOR_ID`, which only ever applies to an anonymous session.
 */
export function resolveDoctorId(user: User | null | undefined): number {
  if (!user || user.role !== "DOCTOR") return FALLBACK_DOCTOR_ID;
  if (typeof user.doctorId === "number" && Number.isFinite(user.doctorId)) {
    return user.doctorId;
  }
  return DOCTOR_ID_BY_EMAIL.get(normalizeEmail(user.email)) ?? FALLBACK_DOCTOR_ID;
}

/**
 * The profile to render for a session. A recognised account gets its seeded
 * record; anything else (an unregistered demo login) keeps the display name
 * the user typed and is flagged so the UI can say it is not a live roster row.
 */
export function resolveDoctorProfile(
  user: User | null | undefined,
  doctorId: number,
): { profile: DoctorProfile; isSeeded: boolean } {
  const seeded = DOCTOR_BY_ID.get(doctorId);
  if (seeded && (!user || user.email.toLowerCase() === seeded.email.toLowerCase())) {
    return { profile: seeded, isSeeded: true };
  }

  const fallback: DoctorProfile = {
    id: doctorId,
    fullName: user?.fullName?.trim() || "Bác sĩ",
    title: "",
    credential: "",
    email: user?.email ?? "",
    roomNumber: seeded?.roomNumber ?? "Chưa phân phòng",
    departmentName: seeded?.departmentName ?? "Chuyên khoa",
    departmentId: seeded?.departmentId ?? FALLBACK_DEPARTMENT_ID,
  };
  return { profile: fallback, isSeeded: false };
}

/** "Trần Minh Tuấn" -> "TM": surname initial + first given-name initial. */
export function initialsOf(fullName: string): string {
  const words = fullName
    .replace(TITLE_PREFIX_PATTERN, "")
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "");
  return letters.join("") || "BS";
}
