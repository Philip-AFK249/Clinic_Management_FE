import type { ActiveAppointment } from "./patientMockRecords";
import { isValidTicketNumber } from "../../../services/intakeApi";
import type { QueueStatus } from "../../../services/intakeApi";

/**
 * Where a confirmed appointment lives between the booking flow and the
 * dashboard.
 *
 * BookingPage writes it on confirmation and PatientDashboardPage reads it on
 * mount: the dashboard must not invent an appointment for a patient who never
 * booked one, so "no stored booking" has to be a real, reachable state.
 */
export const ACTIVE_BOOKING_STORAGE_KEY = "patient_active_booking";

/**
 * Keys an earlier build wrote to and then abandoned. Left in place they would
 * keep resurrecting a legacy mock ticket (`#APT-2026-8821`) that the intake
 * service rejects with a 400 on every poll, so both are swept on every read.
 */
const LEGACY_STORAGE_KEYS = ["clinic_active_booking"];

const QUEUE_STATUSES: readonly QueueStatus[] = [
  "WAITING",
  "CALLED",
  "IN_CONSULTATION",
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
];

function isActiveAppointment(value: unknown): value is ActiveAppointment {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  if (
    typeof source.ticketCode !== "string" ||
    typeof source.patientName !== "string" ||
    typeof source.department !== "string" ||
    typeof source.doctor !== "string" ||
    typeof source.room !== "string" ||
    typeof source.date !== "string" ||
    typeof source.timeSlot !== "string"
  ) {
    return false;
  }
  // A structural pass is not enough: the UI once stored a placeholder number
  // (`#APT-2026-8821`) that the backend cannot look up. Anything outside the
  // `#A-001` shape the service actually mints is treated as garbage.
  if (!isValidTicketNumber(source.ticketCode)) return false;
  // The three backend-facing fields are optional (records written before they
  // existed lack them), but when present they must be the right shape -
  // otherwise a half-typed write would pass the guard and then crash polling.
  if (source.patientId !== undefined && typeof source.patientId !== "number") {
    return false;
  }
  if (source.doctorId !== undefined && typeof source.doctorId !== "number") {
    return false;
  }
  if (
    source.status !== undefined &&
    (typeof source.status !== "string" ||
      !QUEUE_STATUSES.includes(source.status as QueueStatus))
  ) {
    return false;
  }
  return true;
}

/** The stored appointment, or `null` when the patient has not booked yet. */
export function readActiveBooking(): ActiveAppointment | null {
  try {
    sweepLegacyKeys();
    const raw = localStorage.getItem(ACTIVE_BOOKING_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isActiveAppointment(parsed)) return parsed;
    // Corrupted, half-written, or a mock ticket: keep the dashboard from ever
    // polling it again rather than leaving a landmine for the next mount.
    clearActiveBooking();
    return null;
  } catch {
    // Private-mode Safari and a corrupted entry both land here; "cannot tell"
    // has to read as "no booking".
    return null;
  }
}

export function writeActiveBooking(appointment: ActiveAppointment): void {
  try {
    localStorage.setItem(ACTIVE_BOOKING_STORAGE_KEY, JSON.stringify(appointment));
  } catch {
    // A full or blocked localStorage only costs the patient a re-entry after a
    // reload - the booking itself already succeeded.
  }
}

export function clearActiveBooking(): void {
  try {
    localStorage.removeItem(ACTIVE_BOOKING_STORAGE_KEY);
    sweepLegacyKeys();
  } catch {
    // Nothing to do - there is no fallback store left behind.
  }
}

function sweepLegacyKeys(): void {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore: sweeping is best-effort hygiene, never a hard dependency.
    }
  }
}
