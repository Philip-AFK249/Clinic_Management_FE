import type { ActiveAppointment } from "./patientMockRecords";

/**
 * Where a confirmed appointment lives between the booking flow and the
 * dashboard.
 *
 * BookingPage writes it on confirmation and PatientDashboardPage reads it on
 * mount: the dashboard must not invent an appointment for a patient who never
 * booked one, so "no stored booking" has to be a real, reachable state.
 */
export const ACTIVE_BOOKING_STORAGE_KEY = "patient_active_booking";

function isActiveAppointment(value: unknown): value is ActiveAppointment {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.ticketCode === "string" &&
    typeof source.patientName === "string" &&
    typeof source.department === "string" &&
    typeof source.doctor === "string" &&
    typeof source.room === "string" &&
    typeof source.date === "string" &&
    typeof source.timeSlot === "string"
  );
}

/** The stored appointment, or `null` when the patient has not booked yet. */
export function readActiveBooking(): ActiveAppointment | null {
  try {
    const raw = localStorage.getItem(ACTIVE_BOOKING_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isActiveAppointment(parsed) ? parsed : null;
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
  } catch {
    // Nothing to do - there is no fallback store left behind.
  }
}