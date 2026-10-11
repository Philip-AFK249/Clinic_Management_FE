import { Clock } from "lucide-react";
import type { SessionName } from "../../../services/voiceTriageApi";
import { SESSION_SLOT_TIMES } from "../data/bookingSlots";

/** One selectable 60-minute start time. */
export function SlotChip({
  slot,
  isSelected,
  disabled,
  onSelect,
}: {
  slot: string;
  isSelected: boolean;
  disabled: boolean;
  onSelect: (slot: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      disabled={disabled}
      aria-pressed={isSelected}
      className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm font-semibold transition-colors ${
        isSelected
          ? "border-clinical-600 bg-clinical-600 text-white"
          : disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            : "border-slate-200 bg-white text-slate-700 hover:border-clinical-300 hover:bg-clinical-50/40"
      }`}
    >
      {slot}
    </button>
  );
}

interface BookingSlotChipsProps {
  /** The picked start time (`HH:mm`), or `null` when nothing is picked. */
  value: string | null;
  onSelect: (slot: string) => void;
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
  isDisabled,
}: BookingSlotChipsProps) {
  const groups: { label: SessionName; slots: string[] }[] = [
    { label: "MORNING", slots: SESSION_SLOT_TIMES.MORNING },
    { label: "AFTERNOON", slots: SESSION_SLOT_TIMES.AFTERNOON },
  ];

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Clock className="h-3.5 w-3.5 text-clinical-600" aria-hidden="true" />
            {group.label === "MORNING" ? "Buổi sáng" : "Buổi chiều"}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.slots.map((slot) => (
              <SlotChip
                key={slot}
                slot={slot}
                isSelected={value === slot}
                disabled={isDisabled?.(slot) ?? false}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
