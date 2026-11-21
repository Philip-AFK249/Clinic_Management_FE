/**
 * Shared three-minute hold math for the approval board and the patient status
 * screen. Every display derives from an absolute deadline (or from a server
 * `remainingSeconds` captured once), never from decrementing a counter on each
 * tick: a throttled browser tab or a slow poll must not stretch the hold.
 */
export const HOLD_WINDOW_SECONDS = 180;

export interface HoldSource {
  holdExpiresAt?: string | null | undefined;
  remainingSeconds?: number | null | undefined;
  /** Fallback anchor when neither of the above is supplied by the backend. */
  checkInTime?: string | null | undefined;
}

/** `180` -> `03:00`, `59` -> `00:59`, negative -> `00:00`. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Accept both numeric and numeric-string `remainingSeconds` from the wire. */
export function parseRemainingSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Math.max(0, Math.floor(Number(value)));
  }
  return null;
}

/** Parse an ISO datetime defensively; an unparseable value is "unknown". */
export function parseDateMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The absolute deadline for a hold, when the payload knows one.
 *
 * `holdExpiresAt` is authoritative. A bare `remainingSeconds` is anchored at
 * the moment it was first read by the caller (see `useAppointmentCountdown`),
 * because polling it every N seconds and re-anchoring would make the countdown
 * stand still. `checkInTime` is only a last-resort anchor for older backends.
 */
export function holdDeadlineMs(source: HoldSource, now: number = Date.now()): number | null {
  const explicit = parseDateMs(source.holdExpiresAt);
  if (explicit !== null) return explicit;
  const remaining = parseRemainingSeconds(source.remainingSeconds);
  if (remaining !== null) return now + remaining * 1000;
  const checkIn = parseDateMs(source.checkInTime);
  return checkIn === null ? null : checkIn + HOLD_WINDOW_SECONDS * 1000;
}

/** Seconds left until a deadline, clamped to the hold window. */
export function secondsUntilDeadline(deadlineMs: number, now: number = Date.now()): number {
  return Math.min(
    HOLD_WINDOW_SECONDS,
    Math.max(0, Math.ceil((deadlineMs - now) / 1000)),
  );
}
