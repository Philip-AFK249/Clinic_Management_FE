export type TriageLevel = "P1" | "P2" | "P3";

export interface KioskPatient {
  ticketCode: string;
  patientName: string;
  patientId: string;
  dob: string;
  age: number;
  gender: "Nam" | "Nữ";
  insuranceCode: string;
  insuranceSerial: string;
  initialHospitalCode: string;
  insuranceValidUntil: string;
  checkoutCode: string;
}

export interface SymptomOption {
  id: string;
  icon: string;
  label: string;
  triage: TriageLevel;
  department: string;
  room: string;
  priorityLabel: string;
  isEmergency?: boolean;
  /**
   * `departments.id` in DoctorScheduleService (:8081), i.e. the id
   * PatientIntakeService expects on /check-in. The `department` string above is
   * kiosk signage; the backend row is the source of truth for routing.
   */
  departmentId: number;
}

export interface RoomInfo {
  id: string;
  number: string;
  name: string;
  floor: "Tầng Trệt" | "Tầng 2";
  doctor?: string;
}

export const KIOSK_PATIENT: KioskPatient = {
  ticketCode: "#APT-2026-8821",
  patientName: "NGUYỄN VĂN AN",
  patientId: "FHIR-P-88219",
  dob: "14/08/1984",
  age: 42,
  gender: "Nam",
  insuranceCode: "DN 4 79 79 12345678",
  insuranceSerial: "DN 4 79 79 12345678",
  initialHospitalCode: "79-014 (BV Đa Khoa Sài Gòn)",
  insuranceValidUntil: "31/12/2026",
  checkoutCode: "#APT-2026-8821",
};

/**
 * Each kiosk symptom routes to one of the three seeded departments:
 * 1 = Nội Tổng quát & Tim mạch, 2 = Hô hấp & Dị ứng, 3 = Da liễu.
 * Paediatrics, emergency walk-ins and follow-ups have no dedicated seeded
 * department, so they are absorbed by general medicine.
 */
export const SYMPTOM_OPTIONS: SymptomOption[] = [
  {
    id: "symptom-throat",
    icon: "🌡️",
    label: "Sốt cao & Đau rát họng",
    triage: "P2",
    department: "Khoa Dị ứng & Hô hấp",
    room: "Phòng 201",
    priorityLabel: "CẦN KHÁM SỚM",
    departmentId: 2,
  },
  {
    id: "symptom-breathing",
    icon: "🫁",
    label: "Khó thở cấp tính / Đau tức ngực",
    triage: "P1",
    department: "Cấp cứu",
    room: "Phòng 101",
    priorityLabel: "KHẨN CẤP",
    isEmergency: true,
    departmentId: 1,
  },
  {
    id: "symptom-rash",
    icon: "🩹",
    label: "Nổi mẩn ngứa / Mề đay dị ứng",
    triage: "P2",
    department: "Khoa Da liễu & Dị ứng",
    room: "Phòng 205",
    priorityLabel: "CẦN KHÁM SỚM",
    departmentId: 3,
  },
  {
    id: "symptom-pediatric",
    icon: "👶",
    label: "Khám Nhi khoa (Trẻ em)",
    triage: "P3",
    department: "Khoa Nhi",
    room: "Phòng 108",
    priorityLabel: "THƯỜNG",
    departmentId: 1,
  },
  {
    id: "symptom-general",
    icon: "🩺",
    label: "Khám Nội Tổng quát / Tầm soát",
    triage: "P3",
    department: "Khoa Nội",
    room: "Phòng 104",
    priorityLabel: "THƯỜNG",
    departmentId: 1,
  },
  {
    id: "symptom-followup",
    icon: "📋",
    label: "Tái khám định kỳ & Lấy thuốc",
    triage: "P3",
    department: "Tái khám",
    room: "Phòng 108",
    priorityLabel: "THƯỜNG",
    departmentId: 1,
  },
];

export const ROOMS: RoomInfo[] = [
  { id: "room-101", number: "101", name: "Cấp cứu", floor: "Tầng Trệt" },
  { id: "room-104", number: "104", name: "Khám Nội", floor: "Tầng Trệt", doctor: "BS. Phạm Quốc Bảo" },
  { id: "room-108", number: "108", name: "Khám Nhi", floor: "Tầng Trệt", doctor: "BS. CKI. Nguyễn Văn Dũng" },
  { id: "room-201", number: "201", name: "Dị ứng - Miễn dịch lâm sàng", floor: "Tầng 2", doctor: "PGS. TS. BS. Trần Minh Tuấn" },
  { id: "room-205", number: "205", name: "Tai Mũi Họng", floor: "Tầng 2", doctor: "ThS. BS. Lê Thị Hoàng Yến" },
];

export const TICKET_NUMBER = "#A-102";
export const QUEUE_PRIORITY_SCORE = 150;
export const ESTIMATED_WAIT_MINUTES = 6;
export const PATIENTS_AHEAD = 1;

export const OCR_EXTRACT_SECTIONS = [
  "Mã thẻ BHYT: DN 4 79 79 12345678",
  "Họ tên: Nguyễn Văn An",
  "Ngày sinh: 14/08/1984 · Giới tính: Nam",
  "Nơi KCB ban đầu: 79-014 (BV Đa Khoa Sài Gòn)",
  "Ngày đăng ký KCB: 10/09/2026",
];