import type { QueueTicket } from "../../../services/intakeApi";
import type {
  BookingSource,
  Gender,
  PatientRecord,
  TriageLevel,
  Vitals,
} from "./doctorMockData";

/** Unmeasured placeholder. The queue API carries no vitals, and 0 must never
 *  be rendered as a real reading in a clinical UI. */
const NOT_MEASURED: Vitals = { bp: "", hr: 0, temp: "", spo2: 0 };

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
 * components render. The intake API only carries administrative data, so the
 * clinical history sections stay empty and are explicitly flagged as unknown
 * rather than fabricated.
 */
export function ticketToPatientRecord(ticket: QueueTicket): PatientRecord {
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
    vitals: NOT_MEASURED,
    vitalsRecorded: false,
    pastEncounters: [],
    labReports: [],
    scannedOldPrescriptions: [],
  };
}
