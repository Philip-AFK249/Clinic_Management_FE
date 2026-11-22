import { Clock } from "lucide-react";
import type { SessionName } from "../../../services/voiceTriageApi";
import {
  SESSION_SLOT_TIMES,
  isMorningSessionElapsed,
  isSlotElapsed,
} from "../data/bookingSlots";

/** One selectable 60-minute start time. */
export function SlotChip({
  slot,
  isSelected,
  disabled,
  isElapsed = false,
  onSelect,
}: {
  slot: string;
  isSelected: boolean;
  disabled: boolean;
  /** The slot's hour has fully passed; still clickable on an elapsed morning. */
  isElapsed?: boolean;
  onSelect: (slot: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        // The dispatcher card may itself be tappable on an elapsed morning;
        // let the chip pick its own exact hour instead of bubbling a card-level
        // default on top of it.
        event.stopPropagation();
        onSelect(slot);
      }}
      disabled={disabled}
      aria-pressed={isSelected}
      aria-disabled={disabled}
      title={isElapsed ? "Khung giờ này đã qua" : undefined}
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg border px-2 text-sm font-semibold transition-colors ${
        isSelected
          ? "border-clinical-600 bg-clinical-600 text-white"
          : disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            : isElapsed
              ? "border-slate-300 bg-slate-100 text-slate-500 hover:border-slate-400 hover:bg-slate-200"
              : "border-slate-200 bg-white text-slate-700 hover:border-clinical-300 hover:bg-clinical-50/40"
      }`}
    >
      <span className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
        <span>{slot}</span>
        {isElapsed && (
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
            Đã qua giờ
          </span>
        )}
      </span>
    </button>
  );
}

interface BookingSlotChipsProps {
  /** The picked start time (`HH:mm`), or `null` when nothing is picked. */
  value: string | null;
  onSelect: (slot: string) => void;
  /** `YYYY-MM-DD` the chips belong to, used to mark elapsed hours. */
  targetDate?: string;
  /** Renders a chip disabled - full session, no capacity left, or already past. */
  isDisabled?: (slot: string) => boolean;
}

/**
 * Both halves of the day as inline chip groups.
 *
 * Used by the keyword triage path, which has no session payload to hang the
 * chips on; the voice path renders `SlotChip` inside each dispatcher session
 * card instead.
 */
export default function BookingSlotChips({
  value,
  onSelect,
  targetDate = "",
  isDisabled,
}: BookingSlotChipsProps) {
  const groups: { label: SessionName; slots: string[] }[] = [
    { label: "MORNING", slots: SESSION_SLOT_TIMES.MORNING },
    { label: "AFTERNOON", slots: SESSION_SLOT_TIMES.AFTERNOON },
  ];
  const morningElapsed = targetDate
    ? isMorningSessionElapsed(targetDate)
    : false;

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const groupElapsed = group.label === "MORNING" && morningElapsed;
        return (
          <div key={group.label} className={groupElapsed ? "opacity-80" : ""}>
            <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Clock className="h-3.5 w-3.5 text-clinical-600" aria-hidden="true" />
              {group.label === "MORNING" ? "Buổi sáng" : "Buổi chiều"}
              {groupElapsed && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-slate-600">
                  Đã qua giờ sáng nay
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group.slots.map((slot) => (
                <SlotChip
                  key={slot}
                  slot={slot}
                  isSelected={value === slot}
                  isElapsed={targetDate ? isSlotElapsed(targetDate, slot) : false}
                  disabled={groupElapsed ? false : (isDisabled?.(slot) ?? false)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
