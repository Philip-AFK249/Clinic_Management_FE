import type {
  QueueTicket,
  QueueTicketDetailResponse,
} from "../../../services/intakeApi";
import type {
  BookingSource,
  Gender,
  PatientRecord,
  TriageLevel,
  Vitals,
} from "./doctorMockData";

/** Unmeasured placeholder. 0 must never be rendered as a real reading. */
const NOT_MEASURED: Vitals = { bp: "", hr: 0, temp: "", spo2: 0 };

/**
 * The ticket's nurse-recorded vitals, in the presentation shape the banner and
 * the copilot context render. `recorded` is false while nothing has been
 * measured, so the UI says "unknown" instead of showing zeros.
 */
function vitalsFromTicket(ticket: QueueTicket): { vitals: Vitals; recorded: boolean } {
  const bp = ticket.bloodPressure?.trim() ?? "";
  const hr = ticket.heartRate ?? 0;
  const rawTemp = ticket.temperature?.trim() ?? "";
  const spo2 = ticket.spo2 ?? 0;
  const recorded = Boolean(bp || hr > 0 || rawTemp || spo2 > 0);
  if (!recorded) return { vitals: NOT_MEASURED, recorded: false };
  return {
    vitals: {
      bp,
      hr,
      // The banner prints the unit as a suffix; the mock records bake "°C"
      // into the string, so normalise to that convention here.
      temp: rawTemp && !rawTemp.includes("°") ? `${rawTemp}°C` : rawTemp,
      spo2,
    },
    recorded: true,
  };
}

/**
 * The Objective-section line a doctor should not have to retype: what the
 * điều dưỡng measured at the station, in one sentence. Empty when the ticket
 * carries no vitals at all, so a blank O section is never seeded with
 * placeholders.
 */
export function vitalsObjectiveLine(detail: QueueTicketDetailResponse): string {
  const bp = detail.bloodPressure?.trim() ?? "";
  const hr = detail.heartRate ?? 0;
  const temp = detail.temperature?.trim() ?? "";
  const spo2 = detail.spo2 ?? 0;
  if (!bp && hr <= 0 && !temp && spo2 <= 0) return "";

  const physique = [
    detail.weightKg ? `${detail.weightKg}kg` : "",
    detail.heightCm ? `${detail.heightCm}cm` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return [
    `Dấu hiệu sinh tồn: Huyết áp ${bp || "--"} mmHg, Mạch ${hr > 0 ? hr : "--"} ck/phút, SpO2 ${spo2 > 0 ? spo2 : "--"}%, Thân nhiệt ${temp || "--"}°C.`,
    physique ? `Thể trạng: ${physique}.` : "",
    `Ghi chú ĐD: ${detail.nurseNotes?.trim() || "Không có"}`,
  ]
    .filter(Boolean)
    .join(" ");
}

const PRIORITY_SCORE: Record<TriageLevel, number> = { P1: 150, P2: 95, P3: 60 };

const SOURCE_LABEL: Record<string, BookingSource> = {
  KIOSK_QR: "Kiosk QR",
  KIOSK_OCR: "Kiosk OCR",
  RECEPTION_MANUAL: "Quầy tiếp đón",
  ONLINE_BOOKING: "Ứng dụng Bệnh nhân",
};

function toGender(raw: string | null): Gender {
  const value = (raw ?? "").trim().toUpperCase();
  if (["NAM", "M", "MALE", "MALE."].includes(value)) return "Nam";
  if (["NỮ", "NU", "N", "FEMALE"].includes(value)) return "Nữ";
  return "Khác";
}

function toDateLabel(iso: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "--/--/----";
}

function toClock(iso: string | null): string {
  const match = /T(\d{2}:\d{2})/.exec(iso ?? "");
  return match ? match[1] : "--:--";
}

function ageFrom(iso: string | null): number {
  if (!iso) return 0;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return 0;
  const years = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
  return years > 0 && years < 130 ? Math.floor(years) : 0;
}

function waitingMinutesFrom(iso: string | null): number {
  if (!iso) return 0;
  const checkedIn = new Date(iso);
  if (Number.isNaN(checkedIn.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - checkedIn.getTime()) / 60000));
}

/**
 * Projects a queue ticket onto the richer `PatientRecord` shape the EHR
 * components render. The intake API carries the administrative data plus the
 * vitals an điều dưỡng recorded on the ticket, so those are mapped straight
 * through; the clinical history sections stay empty and are explicitly flagged
 * as unknown rather than fabricated.
 */
export function ticketToPatientRecord(ticket: QueueTicket): PatientRecord {
  const { vitals, recorded } = vitalsFromTicket(ticket);
  return {
    ticketNumber: ticket.ticketNumber,
    name: ticket.patient?.fullName ?? "Không rõ họ tên",
    patientId: `FHIR-P-${ticket.patient?.id ?? "?"}`,
    dob: toDateLabel(ticket.patient?.dateOfBirth ?? null),
    age: ageFrom(ticket.patient?.dateOfBirth ?? null),
    gender: toGender(ticket.patient?.gender ?? null),
    insuranceCode: ticket.patient?.insuranceCode ?? "Chưa cập nhật",
    initialHospitalCode: ticket.patient?.initialHospitalCode ?? "Chưa rõ nơi KCB",
    isOcrVerified: ticket.patient?.isOcrVerified ?? false,
    arrivalTime: toClock(ticket.checkInTime),
    waitingMinutes: waitingMinutesFrom(ticket.checkInTime),
    chiefComplaint:
      ticket.chiefComplaint ?? "Bệnh nhân không cung cấp mô tả triệu chứng tại quầy.",
    source: SOURCE_LABEL[ticket.intakeSource] ?? "Quầy tiếp đón",
    triage: ticket.priorityLevel,
    priorityScore: PRIORITY_SCORE[ticket.priorityLevel] ?? 60,
    disclaimerAccepted: false,
    allergies: [],
    // Flagged so the UI says "unknown" instead of "no known allergies".
    allergiesKnown: false,
    vitals,
    vitalsRecorded: recorded,
    pastEncounters: [],
    labReports: [],
    scannedOldPrescriptions: [],
  };
}
