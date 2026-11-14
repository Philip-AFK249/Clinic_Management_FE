import { CalendarClock, Moon, Sun, X } from "lucide-react";

interface RescheduleMorningModalProps {
  /** Clinic wall clock when the prompt opened, `HH:mm`. */
  nowLabel: string;
  /** Today as `dd/MM`. */
  todayLabel: string;
  /** Tomorrow as `dd/MM`. */
  tomorrowLabel: string;
  /** The morning hour the patient tapped, `HH:mm`. */
  clickedSlotTime: string;
  /** Earliest still-open afternoon hour today, or `null`. */
  earliestAfternoonSlot: string | null;
  onConfirmTomorrow: () => void;
  onChooseAfternoon: (slot: string) => void;
  onClose: () => void;
}

/**
 * A deliberately plain, large-target confirmation for a low-tech patient who
 * tapped a morning slot after the morning session has ended.
 *
 * Zero technical vocabulary: the two choices are "same hour tomorrow morning"
 * and "this afternoon if there is still room", with a plain close fallback.
 */
export default function RescheduleMorningModal({
  nowLabel,
  todayLabel,
  tomorrowLabel,
  clickedSlotTime,
  earliestAfternoonSlot,
  onConfirmTomorrow,
  onChooseAfternoon,
  onClose,
}: RescheduleMorningModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-morning-title"
      aria-describedby="reschedule-morning-body"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-elevated sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <CalendarClock className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2
              id="reschedule-morning-title"
              className="pt-1 text-xl font-bold leading-snug text-slate-900 sm:text-2xl"
            >
              Ca khám buổi sáng hôm nay đã kết thúc
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p
          id="reschedule-morning-body"
          className="mt-4 text-lg leading-relaxed text-slate-700"
        >
          Bây giờ đã là {nowLabel}, phòng khám đã hết giờ tiếp nhận ca sáng hôm
          nay ({todayLabel}). Cô/Bác có muốn hệ thống tự động chuyển lịch sang
          Sáng mai ({tomorrowLabel}) lúc {clickedSlotTime} không?
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            autoFocus
            onClick={onConfirmTomorrow}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-clinical-600 px-4 text-lg font-bold text-white transition-colors hover:bg-clinical-700 focus:outline-none focus:ring-4 focus:ring-clinical-200"
          >
            <Sun className="h-6 w-6 shrink-0" aria-hidden="true" />
            <span>
              Đổi sang Sáng mai ({tomorrowLabel}) lúc {clickedSlotTime}
            </span>
          </button>

          {earliestAfternoonSlot ? (
            <button
              type="button"
              onClick={() => onChooseAfternoon(earliestAfternoonSlot)}
              className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 text-lg font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
            >
              <Moon className="h-6 w-6 shrink-0 text-clinical-600" aria-hidden="true" />
              Khám chiều nay lúc {earliestAfternoonSlot}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[56px] w-full items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 text-lg font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
            >
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
