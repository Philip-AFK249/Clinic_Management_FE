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

/** The clinic runs on Vietnam time regardless of the browser's timezone. */
const CLINIC_TIME_ZONE = "Asia/Ho_Chi_Minh";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

interface ClinicClock {
  dateISO: string;
  hhmm: string;
  hour: number;
}

/** Read the wall clock in `Asia/Ho_Chi_Minh`, not in the device's locale. */
function clinicClock(now: Date = new Date()): ClinicClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    dateISO: `${values.year}-${values.month}-${values.day}`,
    hhmm: `${values.hour}:${values.minute}`,
    hour: Number(values.hour),
  };
}

/** `YYYY-MM-DD` on the clinic's calendar. */
export function clinicTodayIso(now: Date = new Date()): string {
  return clinicClock(now).dateISO;
}

/** `HH:mm` on the clinic's wall clock. */
export function clinicNowHHmm(now: Date = new Date()): string {
  return clinicClock(now).hhmm;
}

/** Add minutes to an `HH:mm` time, wrapping around midnight. */
export function addMinutesToHHmm(slot: string, minutes: number): string {
  const [hourText, minuteText] = slot.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return slot;
  const total = (hour * 60 + minute + minutes + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/** A slot runs for one hour, so its end time is its start time + 60 minutes. */
export function slotEndTime(slot: string): string {
  return addMinutesToHHmm(slot, 60);
}

/**
 * True when a 60-minute slot has fully elapsed on `date`.
 *
 * Today the cut-off is `endTime` (start + 1h): a patient can still be seated
 * during the hour itself. Dates before today are entirely elapsed; dates after
 * today are never elapsed.
 */
export function isSlotElapsed(
  date: string,
  slot: string,
  now: Date = new Date(),
): boolean {
  if (!date) return false;
  const clock = clinicClock(now);
  if (date < clock.dateISO) return true;
  if (date > clock.dateISO) return false;
  return clock.hhmm >= slotEndTime(slot);
}

/**
 * The whole morning half (07:30 - 11:30) is over once the clinic clock reaches
 * 11:30 on that same day.
 */
export function isMorningSessionElapsed(
  date: string,
  now: Date = new Date(),
): boolean {
  const clock = clinicClock(now);
  return date === clock.dateISO && clock.hhmm >= "11:30";
}

/**
 * True when a slot's start time has already passed on `date`.
 *
 * Kept for callers that still want the old start-time cut-off; the booking
 * flow uses `isSlotElapsed` because a 60-minute consultation occupies the full
 * hour.
 */
export function isSlotPast(date: string, slot: string): boolean {
  const start = new Date(`${date}T${slot}:00`);
  return Number.isNaN(start.getTime()) ? false : start.getTime() <= Date.now();
}

/**
 * Today, or `dayOffset` days from it (negative = past), on the clinic's
 * calendar.
 *
 * Built from the `Asia/Ho_Chi_Minh` date parts rather than the device's local
 * offset, so a browser in another timezone still lands on the date the clinic
 * is actually open.
 */
export function clinicDayOffsetIso(
  dayOffset = 0,
  now: Date = new Date(),
): string {
  const clock = clinicClock(now);
  const [year, month, day] = clock.dateISO.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day + dayOffset));
  return `${target.getUTCFullYear()}-${pad2(target.getUTCMonth() + 1)}-${pad2(target.getUTCDate())}`;
}

/** Backwards-compatible alias for `clinicDayOffsetIso`. */
export function dayOffsetIso(dayOffset = 0): string {
  return clinicDayOffsetIso(dayOffset);
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
  const clock = clinicClock();
  if (clock.hour >= 17) return clinicDayOffsetIso(1);
  return clinicDayOffsetIso(0);
}
