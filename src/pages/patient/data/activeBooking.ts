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
 *
 * The key is scoped to the owner's email (`patient_active_booking_<email>`)
 * because a browser on localhost holds one localStorage for every account that
 * ever signs in on it. An unscoped key lets a freshly created patient see the
 * ticket someone else booked during earlier testing - and, after an admin
 * deletes that other account, resurrects a ticket that belongs to nobody
 * signed-in at all.
 */
const ACTIVE_BOOKING_STORAGE_PREFIX = "patient_active_booking";

/**
 * Keys an earlier build wrote to and then abandoned - including the original
 * unscoped booking key. Left in place they would keep resurrecting a legacy
 * mock ticket (`#APT-2026-8821`) or leaking one patient's appointment into
 * another's session, so all are swept on every read and clear.
 */
const LEGACY_STORAGE_KEYS = ["clinic_active_booking", "patient_active_booking"];

const QUEUE_STATUSES: readonly QueueStatus[] = [
  "WAITING",
  "CALLED",
  "IN_CONSULTATION",
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
];

/** The storage key for one account; empty email has no key at all. */
function scopedKey(ownerEmail: string | null | undefined): string | null {
  const email = ownerEmail?.trim().toLowerCase();
  return email ? `${ACTIVE_BOOKING_STORAGE_PREFIX}_${email}` : null;
}

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
  if (source.phone !== undefined && typeof source.phone !== "string") {
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

/** Fold a person's name for comparison: trim, collapse runs, case-fold. */
function normalizeName(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

/** Fold a phone number: keep the digits, so "0912 345 678" == "0912345678". */
function normalizePhone(value: string | null | undefined): string {
  return value?.replace(/\D/g, "") ?? "";
}

/**
 * Whether a cached ticket can be shown to the signed-in account.
 *
 * A match on either the printed name or the contact phone is enough: a booking
 * made for a relative carries a different name but the account's own phone, and
 * a booking made under the account's name may predate the phone being stored.
 * Nothing to compare against (an old record with no phone, an account with no
 * name) counts as a mismatch - the safe default is to show nothing rather than
 * someone else's appointment.
 */
export function bookingMatchesUser(
  booking: ActiveAppointment,
  userFullName: string | null | undefined,
  userPhone: string | null | undefined,
): boolean {
  const nameMatches =
    normalizeName(userFullName).length > 0 &&
    normalizeName(booking.patientName) === normalizeName(userFullName);
  const bookingPhone = normalizePhone(booking.phone);
  const phoneMatches =
    bookingPhone.length > 0 &&
    bookingPhone === normalizePhone(userPhone);
  return nameMatches || phoneMatches;
}

/** The signed-in account, as the booking cache needs to know it. */
export interface BookingCacheOwner {
  email: string | null | undefined;
  fullName: string | null | undefined;
  phone: string | null | undefined;
}

/**
 * The stored appointment for this account, or `null`.
 *
 * Reads only the caller's own scoped key - never another user's - and verifies
 * the record against the account before handing it back. A ticket that fails
 * the ownership check (a stale write from a previous build, or data left by a
 * deleted account) is purged on the spot rather than shown.
 */
export function readOwnedActiveBooking(
  owner: BookingCacheOwner | null,
): ActiveAppointment | null {
  try {
    sweepLegacyKeys();
    if (!owner) return null;
    const key = scopedKey(owner.email);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isActiveAppointment(parsed) && bookingMatchesUser(parsed, owner.fullName, owner.phone)) {
      return parsed;
    }
    // Corrupted, half-written, a mock ticket, or someone else's: keep the
    // dashboard from ever polling it again rather than leaving a landmine.
    localStorage.removeItem(key);
    return null;
  } catch {
    // Private-mode Safari and a corrupted entry both land here; "cannot tell"
    // has to read as "no booking".
    return null;
  }
}

export function writeActiveBooking(
  appointment: ActiveAppointment,
  ownerEmail: string | null | undefined,
): void {
  const key = scopedKey(ownerEmail);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(appointment));
  } catch {
    // A full or blocked localStorage only costs the patient a re-entry after a
    // reload - the booking itself already succeeded.
  }
}

/**
 * Drop the cached booking for one account (or, without an email, only the
 * legacy keys). Called on logout so the next account that signs in on this
 * browser starts from a clean slate.
 */
export function clearActiveBooking(ownerEmail?: string | null): void {
  try {
    const key = scopedKey(ownerEmail);
    if (key) localStorage.removeItem(key);
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
