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
