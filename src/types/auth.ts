export type UserRole =
  | "PATIENT"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "PHARMACIST"
  | "ADMIN";

export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  token?: string;
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
}

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

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Bệnh nhân",
    role: "PATIENT",
    email: "patient@clinic.vn",
    password: "Demo@1234",
    redirectPath: "/patient/dashboard",
  },
  {
    label: "Điều dưỡng",
    role: "NURSE",
    email: "hang.trinh@smartclinic.vn",
    password: "Demo@1234",
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
    password: "Demo@1234",
    redirectPath: "/doctor/ehr",
    doctorId: 1,
    departmentId: 1,
  },
  {
    label: "Bác sĩ (Hô hấp - Dị ứng)",
    role: "DOCTOR",
    email: "yen.le@smartclinic.vn",
    password: "Demo@1234",
    redirectPath: "/doctor/ehr",
    doctorId: 4,
    departmentId: 2,
  },
  {
    label: "Bác sĩ (Da liễu)",
    role: "DOCTOR",
    email: "lan.nguyen@smartclinic.vn",
    password: "Demo@1234",
    redirectPath: "/doctor/ehr",
    doctorId: 7,
    departmentId: 3,
  },
  {
    label: "Tiếp đón viên",
    role: "RECEPTIONIST",
    email: "reception@clinic.vn",
    password: "Demo@1234",
    redirectPath: "/reception",
  },
  {
    label: "Dược sĩ",
    role: "PHARMACIST",
    email: "pharmacy@clinic.vn",
    password: "Demo@1234",
    redirectPath: "/pharmacy/queue",
  },
  {
    label: "Quản trị viên",
    role: "ADMIN",
    email: "admin@clinic.vn",
    password: "Demo@1234",
    redirectPath: "/admin/overview",
  },
];

/** Demo account backing a role chip, if that role has a single-entry preset. */
export function demoAccountFor(role: UserRole): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((account) => account.role === role);
}
