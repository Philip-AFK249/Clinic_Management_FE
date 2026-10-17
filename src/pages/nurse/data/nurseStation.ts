import type { QueueStatus, QueueTicket } from "../../../services/intakeApi";

/**
 * Presentation helpers for the nurse station (`/nurse`).
 *
 * Kept in a `.ts` data module because `react-refresh/only-export-components`
 * forbids non-component exports from `.tsx` files.
 */

const PRIORITY_RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2 };

/**
 * Call order at the triage desk: triage weight first (P1 never waits behind a
 * P3), then the booked slot, then who actually checked in first. The reception
 * hook only orders by priority + check-in, which would shuffle patients who
 * hold different slot times within the same priority band.
 */
export function sortNurseQueue(tickets: QueueTicket[]): QueueTicket[] {
  return [...tickets].sort((a, b) => {
    const byPriority =
      (PRIORITY_RANK[a.priorityLevel] ?? 9) - (PRIORITY_RANK[b.priorityLevel] ?? 9);
    if (byPriority !== 0) return byPriority;

    const bySlot = (a.slotStartTime ?? "").localeCompare(b.slotStartTime ?? "");
    if (bySlot !== 0) return bySlot;

    return (a.checkInTime ?? "").localeCompare(b.checkInTime ?? "");
  });
}

/** One action the nurse can take on a ticket in its current status. */
export interface NurseQueueAction {
  label: string;
  status: QueueStatus;
  tone: "primary" | "outline" | "danger";
}

/**
 * Status transitions offered on a ticket. `COMPLETED` / `SKIPPED` /
 * `CANCELLED` are terminal, so those cards only keep the vitals capture.
 */
export function nurseQueueActions(status: QueueStatus): NurseQueueAction[] {
  switch (status) {
    case "WAITING":
      return [
        { label: "Gọi BN", status: "CALLED", tone: "primary" },
        { label: "Bỏ qua", status: "SKIPPED", tone: "outline" },
        { label: "Huỷ", status: "CANCELLED", tone: "danger" },
      ];
    case "CALLED":
      return [
        { label: "Vào khám", status: "IN_CONSULTATION", tone: "primary" },
        { label: "Bỏ qua", status: "SKIPPED", tone: "outline" },
        { label: "Huỷ", status: "CANCELLED", tone: "danger" },
      ];
    case "IN_CONSULTATION":
      return [
        { label: "Hoàn tất", status: "COMPLETED", tone: "primary" },
        { label: "Bỏ qua", status: "SKIPPED", tone: "outline" },
      ];
    default:
      return [];
  }
}

/** Bedside measurements taken before the patient is handed to the bác sĩ. */
export interface VitalsRecord {
  ticketNumber: string;
  patientName: string;
  /** Systolic/diastolic, e.g. "120/80" - stored as typed for display parity. */
  bloodPressure: string;
  /** Lần/phút. */
  heartRate: number;
  /** °C, e.g. "36.7". */
  temperature: string;
  /** Percent. */
  spo2: number;
  /** ISO datetime of the reading. */
  recordedAt: string;
  /** Nurse who took the reading. */
  recordedBy: string;
}

/** Human-readable lines for a saved reading; empty entries are dropped. */
export function vitalsSummary(record: VitalsRecord | undefined): string[] {
  if (!record) return [];
  const lines: string[] = [];
  if (record.bloodPressure.trim()) {
    lines.push(`Huyết áp ${record.bloodPressure.trim()} mmHg`);
  }
  if (record.heartRate > 0) lines.push(`Mạch ${record.heartRate} lần/phút`);
  if (record.temperature.trim()) lines.push(`Nhiệt độ ${record.temperature.trim()} °C`);
  if (record.spo2 > 0) lines.push(`SpO₂ ${record.spo2}%`);
  return lines;
}

/** `HH:MM` from an ISO timestamp, for the "recorded at" line. */
export function clockLabel(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : "--:--";
}

/** Today as the `YYYY-MM-DD` every queue/schedule API expects. */
export function todayISO(reference: Date = new Date()): string {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, "0");
  const day = String(reference.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
