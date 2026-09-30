export type UserRole =
  | "PATIENT"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "PHARMACIST"
  | "ADMIN";

export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface User {
  /**
   * `users.id` from AuthService. That service uses a numeric identity PK, so a
   * real session always carries a number; `string` stays in the type for
   * payloads persisted before the AuthService migration.
   */
  id: string | number;
  email: string;
  fullName: string;
  role: UserRole;
  /** The signed JWT. Always present for a live session. */
  token: string;
  phone?: string;
  avatarUrl?: string;
  /**
   * `doctors.id` in DoctorScheduleService. Only set for DOCTOR accounts; the
   * doctor portal scopes every queue request by it, so it must come from the
   * auth backend rather than being inferred from the email at render time.
   */
  doctorId?: number;
  /**
   * `pharmacists.id` in ClinicalConsultationService. Only set for PHARMACIST
   * accounts; it is stamped on every prescription the pharmacist dispenses.
   */
  pharmacistId?: number;
  /**
   * `departments.id` in the schedule DB. Set for the roles that are scoped to
   * one khoa (DOCTOR, NURSE): it stamps `POST /clinical/encounters/start` and
   * decides which triage desk a nurse is posted to.
   */
  departmentId?: number;
  /** Denormalised from `departmentId` so the header can render it without a lookup. */
  departmentName?: string;

  /* ---------------------------------------------------------------------
   * Patient self-service fields, edited on /patient/profile.
   *
   * These are NOT columns on AuthService's `users` table: that entity carries
   * only id/email/password/full_name/phone/role/department/doctor/pharmacist,
   * and AuthService exposes no endpoint to write them. They are therefore
   * client-only - persisted in `clinic_auth_user` and carried across a re-login
   * by `readStoredProfileFields()` - so they survive a reload but are not yet
   * shared with the backend. Do not treat them as authoritative.
   * ------------------------------------------------------------------- */
  /** ISO `YYYY-MM-DD`, matching `<input type="date">`. */
  dateOfBirth?: string;
  gender?: Gender;
  address?: string;
  /** CCCD / mã định danh: 12 digits. */
  nationalId?: string;
  /** Mã số thẻ BHYT, 15 characters, e.g. `DN 4 79 79 12345678`. */
  insuranceCode?: string;
  /** Mã cơ sở khám chữa bệnh ban đầu, e.g. `79-014`. */
  initialHospitalCode?: string;
  /** True once the BHYT card has been read back through the OCR scanner. */
  insuranceVerified?: boolean;
}

/**
 * The subset of `User` that only ever exists on the client. Used to carry a
 * patient's saved profile and BHYT card across a fresh sign-in, because the
 * login response cannot know about them.
 */
export type PatientProfileFields = Pick<
  User,
  | "dateOfBirth"
  | "gender"
  | "address"
  | "nationalId"
  | "insuranceCode"
  | "initialHospitalCode"
  | "insuranceVerified"
>;

/**
 * Whitelist of the keys `readStoredProfileFields` is allowed to carry forward.
 * Identity, role and token are deliberately absent: those always come from the
 * auth backend, and replaying a stale copy of them would resurrect a revoked
 * session.
 */
export const PATIENT_PROFILE_FIELDS: (keyof PatientProfileFields)[] = [
  "dateOfBirth",
  "gender",
  "address",
  "nationalId",
  "insuranceCode",
  "initialHospitalCode",
  "insuranceVerified",
];

/**
 * Department context chosen on the login screen before the account is known,
 * e.g. the doctor picked "Khoa Da liễu" and then typed a personal email.
 * The email match in the staff directory always wins over this fallback.
 */
export interface LoginExtraContext {
  departmentId?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  dateOfBirth?: string;
  gender?: Gender;
}

export interface DemoAccount {
  label: string;
  role: UserRole;
  email: string;
  password: string;
  redirectPath: string;
  /** Only on DOCTOR presets: the `doctors.id` this account signs in as. */
  doctorId?: number;
  /** Only on the PHARMACIST preset: the `pharmacists.id` stamped on dispensing. */
  pharmacistId?: number;
  /**
   * Set when the preset is tied to one khoa (DOCTOR presets, NURSE post). The
   * name is deliberately absent: it is resolved from the shared department /
   * staff directories so the two cannot drift apart.
   */
  departmentId?: number;
}

/**
 * Where each role lands after signing in. Exhaustive over `UserRole` on
 * purpose: a new role must declare its portal before it can be logged into.
 */
export const ROLE_HOME: Record<UserRole, string> = {
  PATIENT: "/patient/dashboard",
  DOCTOR: "/doctor/ehr",
  NURSE: "/reception",
  RECEPTIONIST: "/reception",
  PHARMACIST: "/pharmacy/queue",
  ADMIN: "/admin/overview",
};

/**
 * The password every account seeded by AuthService's `DataInitializer` shares.
 * Read from the first preset so the login screen can prefill staff chips
 * without repeating the literal.
 */
export const DEMO_PASSWORD = "password123";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Bệnh nhân",
    role: "PATIENT",
    email: "patient@clinic.vn",
    password: DEMO_PASSWORD,
    redirectPath: "/patient/dashboard",
  },
  {
    label: "Điều dưỡng",
    role: "NURSE",
    email: "hang.trinh@smartclinic.vn",
    password: DEMO_PASSWORD,
    redirectPath: "/reception",
    departmentId: 1,
  },
  // One preset per khoa, taken from the seeded `doctors` rows. The login screen
  // builds its staff picker from DOCTOR_DIRECTORY; these are only the defaults
  // used when a role chip is tapped without picking a specific bác sĩ.
  {
    label: "Bác sĩ (Nội - Tim mạch)",
    role: "DOCTOR",
    email: "tuan.tran@smartclinic.vn",
    password: DEMO_PASSWORD,
    redirectPath: "/doctor/ehr",
    doctorId: 1,
    departmentId: 1,
  },
  {
    label: "Bác sĩ (Hô hấp - Dị ứng)",
    role: "DOCTOR",
    email: "yen.le@smartclinic.vn",
    password: DEMO_PASSWORD,
    redirectPath: "/doctor/ehr",
    doctorId: 4,
    departmentId: 2,
  },
  {
    label: "Bác sĩ (Da liễu)",
    role: "DOCTOR",
    email: "lan.nguyen@smartclinic.vn",
    password: DEMO_PASSWORD,
    redirectPath: "/doctor/ehr",
    doctorId: 7,
    departmentId: 3,
  },
  {
    label: "Tiếp đón viên",
    role: "RECEPTIONIST",
    email: "reception@clinic.vn",
    password: DEMO_PASSWORD,
    redirectPath: "/reception",
  },
  {
    label: "Dược sĩ",
    role: "PHARMACIST",
    email: "thao.dang@smartclinic.vn",
    password: DEMO_PASSWORD,
    redirectPath: "/pharmacy/queue",
    pharmacistId: 20,
  },
  {
    label: "Quản trị viên",
    role: "ADMIN",
    email: "admin@smartclinic.vn",
    password: DEMO_PASSWORD,
    redirectPath: "/admin/overview",
  },
];

/** Demo account backing a role chip, if that role has a single-entry preset. */
export function demoAccountFor(role: UserRole): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((account) => account.role === role);
}
