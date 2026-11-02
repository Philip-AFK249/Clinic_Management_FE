/**
 * The date view shared by the reception desk and the nurse station queues.
 *
 * Both screens used to be pinned to `LocalDate.now()`, which is why a ticket
 * booked for tomorrow (after the 17:00 rollover) was visible in the doctor's
 * EHR - where "Sắp tới" exists - but nowhere the ticket is actually processed.
 * The same three-way switch now drives both, so the labels, the day they name
 * and the day they ask the backend for can never drift apart.
 *
 * Kept in a `.ts` data module because `react-refresh/only-export-components`
 * forbids non-component exports from `.tsx` files.
 */

/**
 * Which slice of the calendar a queue panel is showing:
 *
 * - `TODAY` / `TOMORROW`: one day via `GET /queue/reception?date=YYYY-MM-DD`.
 * - `UPCOMING`: `GET /queue/reception/upcoming?fromDate=YYYY-MM-DD` - every
 *   active ticket from today onward, so a pre-booked tomorrow ticket is never
 *   missed while the desk watches today.
 */
export type QueueDateFilter = "TODAY" | "TOMORROW" | "UPCOMING";

/** The three pills, in the order they are offered. */
export const QUEUE_DATE_FILTERS: { key: QueueDateFilter; label: string }[] = [
  { key: "TODAY", label: "Hôm nay" },
  { key: "TOMORROW", label: "Ngày mai" },
  { key: "UPCOMING", label: "Sắp tới" },
];

/**
 * `YYYY-MM-DD` in the browser's local offset, shifted by `dayOffset` days.
 *
 * `toISOString()` alone reports UTC, which reads as "yesterday" during the
 * first hours of the day in Asia/Ho_Chi_Minh - the same correction the
 * booking page and the doctor's queue already apply.
 */
export function isoDayOffset(dayOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** Today in local time. */
export function todayISO(): string {
  return isoDayOffset(0);
}

/** Tomorrow in local time - the day the "Ngày mai" pill asks for. */
export function tomorrowISO(): string {
  return isoDayOffset(1);
}

/**
 * The day a filter is anchored at, i.e. the value that rides along on the
 * request: tomorrow for `TOMORROW`, and today for both `TODAY` and the
 * `fromDate` of the upcoming window (which the backend anchors at "today").
 */
export function filterDateISO(filter: QueueDateFilter): string {
  return filter === "TOMORROW" ? tomorrowISO() : todayISO();
}

/** `YYYY-MM-DD` as the `dd/MM/yyyy` dates are read as. */
export function dateLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/** `YYYY-MM-DD` as the `dd/MM` a per-ticket badge has room for. */
export function shortDateLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}` : iso;
}

/**
 * The caption under a queue panel's title.
 *
 * A list that is not today's has to say so in words: without this the panel
 * keeps its "Ngày 02/11/2026" line while the tickets underneath are tomorrow's.
 */
export function queueDateCaption(date: string, filter: QueueDateFilter): string {
  return filter === "UPCOMING"
    ? `Từ ${dateLabel(date)} trở đi`
    : `Ngày ${dateLabel(date)}`;
}
