export type UserRole = "PATIENT" | "DOCTOR" | "RECEPTIONIST" | "PHARMACIST" | "ADMIN";

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
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Bệnh nhân",
    role: "PATIENT",
    email: "patient@clinic.vn",
    password: "Demo@1234",
    redirectPath: "/patient/dashboard",
  },
  {
    label: "Bác sĩ",
    role: "DOCTOR",
    email: "yen.le@smartclinic.vn",
    password: "Demo@1234",
    redirectPath: "/doctor/ehr",
  },
  {
    label: "Bác sĩ (Nội - Tim mạch)",
    role: "DOCTOR",
    email: "tuan.tran@smartclinic.vn",
    password: "Demo@1234",
    redirectPath: "/doctor/ehr",
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
