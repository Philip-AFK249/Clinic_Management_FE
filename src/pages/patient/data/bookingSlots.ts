import type { SessionName } from "../../../services/voiceTriageApi";

/**
 * The fixed 60-minute start times of each half of the clinic day, as the
 * schedule service books them.
 *
 * The dispatcher renders one group inside each session card; the keyword path
 * (no rota payload) renders both groups from the same table, so the two flows
 * offer identical times and cannot drift apart.
 */
export const SESSION_SLOT_TIMES: Record<SessionName, string[]> = {
  MORNING: ["07:30", "08:30", "09:30", "10:30"],
  AFTERNOON: ["13:00", "14:00", "15:00", "16:00"],
};

/**
 * True when a slot's start time has already passed on `date`.
 *
 * Slots are one hour long, so a start time is the cut-off: once it is in the
 * past the patient could no longer be seated for a full consultation, and the
 * backend's assignment would be nonsense even if the capacity row still said
 * "free".
 */
export function isSlotPast(date: string, slot: string): boolean {
  const start = new Date(`${date}T${slot}:00`);
  return Number.isNaN(start.getTime()) ? false : start.getTime() <= Date.now();
}

/** `YYYY-MM-DD` in the browser's local offset, as `<input type="date">` wants. */
function isoLocalDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Today, or `dayOffset` days from it (negative = past), in local time.
 *
 * The offset correction keeps this on the clinic's calendar: bare
 * `toISOString()` reports UTC, which reads as "yesterday" during the first
 * hours of the day in Asia/Ho_Chi_Minh.
 */
export function dayOffsetIso(dayOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return isoLocalDate(date);
}

/**
 * The date the booking form starts on and the earliest one it offers.
 *
 * Before 17:00 that is today; from the clinic's 17:00 closing time it rolls
 * to tomorrow - mirroring the gateway's own `normalise_target_date` - so the
 * date input (`min`) blocks an already-closed day and the slot grid loads
 * tomorrow's hours instead of today's expired ones.
 */
export function getInitialDate(): string {
  const now = new Date();
  if (now.getHours() >= 17) return dayOffsetIso(1);
  return dayOffsetIso(0);
}
