import type {
  IntakeSource,
  QueueStatus,
  QueueTicket,
  TimeSlotResponse,
  TriagePriority,
} from "../../../services/intakeApi";

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export interface ReceptionDepartment {
  id: number;
  code: string;
  name: string;
  shortName: string;
  /** Per-department prefix used by the backend when generating ticket numbers. */
  ticketPrefix: string;
  roomRange: string;
}

/** Mirrors the `departments` seed rows of DoctorScheduleService (:8081). */
export const RECEPTION_DEPARTMENTS: ReceptionDepartment[] = [
  {
    id: 1,
    code: "INT-CARD",
    name: "Khoa Nội Tổng quát & Tim mạch",
    shortName: "Nội - Tim mạch",
    ticketPrefix: "#A",
    roomRange: "Phòng 101 - 102",
  },
  {
    id: 2,
    code: "RESP-ALLERGY",
    name: "Khoa Hô hấp & Dị ứng - Miễn dịch lâm sàng",
    shortName: "Hô hấp - Dị ứng",
    ticketPrefix: "#B",
    roomRange: "Phòng 201 - 202",
  },
  {
    id: 3,
    code: "DERM",
    name: "Khoa Da liễu",
    shortName: "Da liễu",
    ticketPrefix: "#C",
    roomRange: "Phòng 205 - 206",
  },
];

// ---------------------------------------------------------------------------
// Clinical routing constants
// ---------------------------------------------------------------------------

/**
 * Gender options for the intake form. Values are the canonical enum the rest
 * of the system stores (admin roster, patient profile, doctor queue); labels
 * are the Vietnamese words the secretary picks from.
 */
export const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
];

export interface TriageOption {
  level: TriagePriority;
  label: string;
  shortLabel: string;
  hint: string;
  chipClass: string;
  cardClass: string;
  dotClass: string;
}

export const TRIAGE_OPTIONS: TriageOption[] = [
  {
    level: "P1",
    label: "P1 - Khẩn cấp",
    shortLabel: "P1",
    hint: "Đe dọa tính mạng hoặc đau dữ dội, cần khám ngay lập tức.",
    chipClass: "border-red-200 bg-red-50 text-red-700",
    cardClass: "border-red-300 bg-red-50 text-red-800",
    dotClass: "bg-red-500",
  },
  {
    level: "P2",
    label: "P2 - Cần khám sớm",
    shortLabel: "P2",
    hint: "Triệu chứng nặng tiến triển nhanh, ưu tiên trong vòng 60 phút.",
    chipClass: "border-amber-200 bg-amber-50 text-amber-700",
    cardClass: "border-amber-300 bg-amber-50 text-amber-800",
    dotClass: "bg-amber-500",
  },
  {
    level: "P3",
    label: "P3 - Khám thường",
    shortLabel: "P3",
    hint: "Triệu chứng ổn định, không nguy hiểm, khám theo lịch tuần tự.",
    chipClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cardClass: "border-emerald-300 bg-emerald-50 text-emerald-800",
    dotClass: "bg-emerald-500",
  },
];

const TRIAGE_BY_LEVEL: Record<TriagePriority, TriageOption> = TRIAGE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.level] = option;
    return acc;
  },
  {} as Record<TriagePriority, TriageOption>,
);

export function triageMeta(level: TriagePriority): TriageOption {
  return TRIAGE_BY_LEVEL[level];
}

export interface StatusMeta {
  label: string;
  chipClass: string;
  /** Whether a receptionist may still act on a ticket in this state. */
  actionable: boolean;
}

export const QUEUE_STATUS_META: Record<QueueStatus, StatusMeta> = {
  WAITING: {
    label: "Đang chờ",
    chipClass: "border-amber-200 bg-amber-50 text-amber-700",
    actionable: true,
  },
  CALLED: {
    label: "Đã gọi mã",
    chipClass: "border-clinical-200 bg-clinical-50 text-clinical-700",
    actionable: true,
  },
  IN_CONSULTATION: {
    label: "Đang khám",
    chipClass: "border-teal-200 bg-teal-50 text-teal-700",
    actionable: true,
  },
  COMPLETED: {
    label: "Hoàn tất",
    chipClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    actionable: false,
  },
  SKIPPED: {
    label: "Bỏ qua",
    chipClass: "border-slate-200 bg-slate-100 text-slate-600",
    actionable: false,
  },
  CANCELLED: {
    label: "Đã huỷ",
    chipClass: "border-rose-200 bg-rose-50 text-rose-600",
    actionable: false,
  },
};

export const INTAKE_SOURCE_LABELS: Record<IntakeSource, string> = {
  KIOSK_OCR: "OCR thẻ tại quầy",
  KIOSK_QR: "Quét QR từ Cổng Bệnh nhân",
  RECEPTION_MANUAL: "Nhập tay tại quầy",
  ONLINE_BOOKING: "Đặt lịch online",
};

// ---------------------------------------------------------------------------
// OCR card scan simulation
// ---------------------------------------------------------------------------

export interface OcrCardSample {
  id: string;
  cardLabel: string;
  /** Confidence reported by the reader, 0-100. */
  confidence: number;
  fullName: string;
  identityCardNumber: string;
  insuranceCode: string;
  initialHospitalCode: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
}

export const OCR_CARD_SAMPLES: OcrCardSample[] = [
  {
    id: "CCCD",
    cardLabel: "Thẻ CCCD gắn chip",
    confidence: 98,
    fullName: "TRẦN THỊ MAI",
    identityCardNumber: "079079001234",
    insuranceCode: "DN 4 79 79 55512345",
    initialHospitalCode: "79-014 (BV Đa Khoa Sài Gòn)",
    dateOfBirth: "1968-03-02",
    gender: "Nữ",
    phone: "0905123456",
    address: "12 Lý Thường Kiệt, P. Bến Thành, Quận 1, TP.HCM",
  },
  {
    id: "BHYT",
    cardLabel: "Thẻ BHYT (mặt sau)",
    confidence: 94,
    fullName: "LÊ HOÀNG NAM",
    identityCardNumber: "079091002345",
    insuranceCode: "DN 4 79 79 00234567",
    initialHospitalCode: "79-014 (BV Đa Khoa Sài Gòn)",
    dateOfBirth: "1991-07-09",
    gender: "Nam",
    phone: "0987456123",
    address: "240 Nguyễn Trãi, P.7, Quận 5, TP.HCM",
  },
  {
    id: "EXPIRED",
    cardLabel: "Thẻ BHYT (hết hạn - cần nhập tay)",
    confidence: 41,
    fullName: "PHẠM THU HƯƠNG",
    identityCardNumber: "079059003456",
    insuranceCode: "DN 5 79 79 77881234",
    initialHospitalCode: "79-014 (BV Đa Khoa Sài Gòn)",
    dateOfBirth: "1959-01-12",
    gender: "Nữ",
    phone: "0933778899",
    address: "8 Nguyễn Du, P. Bến Nhà Rồng, Quận 1, TP.HCM",
  },
];

/** Fields the reader claims to have extracted, shown as a live scan feed. */
export const OCR_SCAN_FIELDS: string[] = [
  "Trường Họ tên",
  "Số CCCD / Mã thẻ BHYT",
  "Mã cơ quan BHYT",
  "Nơi KCB ban đầu",
  "Ngày sinh",
  "Giới tính",
];

// ---------------------------------------------------------------------------
// Slot helpers + offline fallback
// ---------------------------------------------------------------------------

/** Morning block is 07:30-11:30, afternoon block is 13:00-17:00 (60-min slots). */
export const SHIFT_BLOCKS: { session: string; start: string }[] = [
  { session: "Buổi sáng", start: "07:30" },
  { session: "Buổi chiều", start: "13:00" },
];

function toTimeLabel(hhmm: string): string {
  return `${hhmm}:00`;
}

function synthesizeSlots(bookedPattern: number[]): TimeSlotResponse[] {
  const slots: TimeSlotResponse[] = [];
  const capacity = 4;
  let bookedIndex = 0;
  for (const block of SHIFT_BLOCKS) {
    for (let i = 0; i < 4; i += 1) {
      const [h, m] = block.start.split(":").map(Number);
      const total = h * 60 + m + i * 60;
      const startTime = toTimeLabel(
        `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`,
      );
      const endTotal = total + 60;
      const endTime = toTimeLabel(
        `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`,
      );
      const bookedCount = bookedPattern[bookedIndex % bookedPattern.length];
      bookedIndex += 1;
      slots.push({
        startTime,
        endTime,
        totalCapacity: capacity,
        bookedCount,
        availableCapacity: Math.max(0, capacity - bookedCount),
        isAvailable: bookedCount < capacity,
      });
    }
  }
  return slots;
}

/** Shown when PatientIntakeService cannot be reached. */
export function buildFallbackSlots(departmentId: number): TimeSlotResponse[] {
  return synthesizeSlots([0, 1, 2, 4, 1, 3, 2, departmentId % 3]);
}

// ---------------------------------------------------------------------------
// Offline queue fallback
// ---------------------------------------------------------------------------

const FALLBACK_PATIENT_NAMES: string[] = [
  "TRẦN THỊ MAI",
  "LÊ HOÀNG NAM",
  "BÙI ĐỨC MINH",
  "PHẠM THU HƯƠNG",
  "NGUYỄN VĂN AN",
  "VŨ MINH ĐỨC",
];

const FALLBACK_COMPLAINTS: string[] = [
  "Khó thở cấp, rít thanh quản, ho khan kéo dài 2 ngày",
  "Phát ban ngứa lan tỏa toàn thân sau uống kháng sinh",
  "Đau họng, viêm amidan hốc mủ nhẹ",
  "Tái khám định kỳ dị ứng thời tiết và nhận thuốc",
  "Sốt cao 38.5°C, nuốt đau rát họng 2 ngày nay",
  "Nổi mẩn đỏ vùng khuỷu tay sau khi cắm cỏ",
];

const FALLBACK_PRIORITIES: TriagePriority[] = ["P1", "P2", "P3", "P3", "P2", "P3"];

/** Synthetic per-department queue used when the backend is unreachable. */
export function buildFallbackQueue(departmentId: number, date: string): QueueTicket[] {
  const department = RECEPTION_DEPARTMENTS.find((d) => d.id === departmentId);
  if (!department) return [];
  const statuses: QueueStatus[] = ["WAITING", "WAITING", "CALLED", "WAITING", "IN_CONSULTATION", "WAITING"];
  const doctorsByDepartment: Record<number, { id: number; name: string; room: string }[]> = {
    1: [
      { id: 1, name: "PGS. TS. BS. Trần Minh Tuấn", room: "Phòng 101" },
      { id: 2, name: "BS. CKI. Nguyễn Văn Dũng", room: "Phòng 102" },
    ],
    2: [
      { id: 4, name: "BS. CKI. Lê Thị Hoàng Yến", room: "Phòng 201" },
      { id: 5, name: "BS. CKII. Phạm Thị Hoa", room: "Phòng 202" },
    ],
    3: [
      { id: 7, name: "BS. CKI. Nguyễn Thị Lan", room: "Phòng 205" },
      { id: 8, name: "ThS. BS. Vũ Minh Đức", room: "Phòng 206" },
    ],
  };
  const doctors = doctorsByDepartment[departmentId];
  const startTime = SHIFT_BLOCKS[0].start;

  return FALLBACK_PATIENT_NAMES.map((fullName, index) => {
    const doctor = doctors[index % doctors.length];
    const priorityLevel = FALLBACK_PRIORITIES[index];
    const status = statuses[index];
    const serial = index + 1;
    return {
      id: departmentId * 1000 + index,
      ticketNumber: `${department.ticketPrefix}-${String(serial).padStart(3, "0")}`,
      patient: {
        id: 88000 + departmentId * 100 + index,
        fullName,
        identityCardNumber: `0790${String(700000 + departmentId * 1000 + index)}`,
        insuranceCode: `DN 4 79 79 ${String(10000000 + index).slice(-8)}`,
        initialHospitalCode: "79-014 (BV Đa Khoa Sài Gòn)",
        dateOfBirth: `${1970 + (index % 30)}-0${(index % 9) + 1}-1${index % 10}`,
        gender: index % 2 === 0 ? "Nam" : "Nữ",
        phone: `090${String(1000000 + index * 7919).slice(0, 7)}`,
        address: "Số 1, Đường Nguyễn Văn Trỗi, TP.HCM",
        isOcrVerified: index % 2 === 0,
        createdAt: `${date}T07:5${index}:00`,
        updatedAt: `${date}T07:5${index}:00`,
      },
      departmentId,
      departmentName: department.name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      roomNumber: doctor.room,
      appointmentDate: date,
      slotStartTime: toTimeLabel(startTime),
      priorityLevel,
      intakeSource: index % 2 === 0 ? "KIOSK_OCR" : "RECEPTION_MANUAL",
      status,
      chiefComplaint: FALLBACK_COMPLAINTS[index],
      checkInTime: `${date}T07:5${index}:00`,
      calledAt: status === "WAITING" ? null : `${date}T08:0${index}:00`,
    } satisfies QueueTicket;
  });
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Only today and tomorrow carry seeded shifts in DoctorScheduleService. */
export function appointmentDateOptions(reference: Date): { value: string; label: string }[] {
  const format = new Intl.DateTimeFormat("ca-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const weekday = new Intl.DateTimeFormat("vi-VN", { weekday: "long" });
  return [0, 1].map((offset) => {
    const day = new Date(reference);
    day.setDate(day.getDate() + offset);
    return {
      // Local calendar date, not UTC: toISOString() would roll back a day for
      // appointments made between 00:00 and 07:00 in Asia/Ho_Chi_Minh.
      value: toIsoDate(day),
      label: `${offset === 0 ? "Hôm nay" : "Ngày mai"} - ${weekday.format(day)}, ${format.format(day)}`,
    };
  });
}

export function isToday(date: string, reference: Date): boolean {
  return date === toIsoDate(reference);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Rough wait estimate: 9.4 min average consultation per patient ahead. */
export const AVERAGE_CONSULTATION_MINUTES = 9.4;

export function estimateWaitMinutes(patientsBefore: number): number {
  return Math.max(0, Math.round(patientsBefore * AVERAGE_CONSULTATION_MINUTES));
}
