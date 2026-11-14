import {
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  Loader2,
  X,
} from "lucide-react";
import type { QueueTicket } from "../../../services/intakeApi";

interface CompleteTicketDialogProps {
  ticket: QueueTicket;
  hasVitals: boolean;
  isBusy: boolean;
  onClose: () => void;
  onMeasure: () => void;
  onComplete: () => void;
}

export default function CompleteTicketDialog({
  ticket,
  hasVitals,
  isBusy,
  onClose,
  onMeasure,
  onComplete,
}: CompleteTicketDialogProps) {
  const patientName = ticket.patient?.fullName ?? "Không rõ họ tên";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Xác nhận hoàn tất ${ticket.ticketNumber}`}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200/80 bg-white shadow-elevated">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                hasVitals
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              {hasVitals ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Hoàn tất phiếu khám
              </h3>
              <p className="text-[11px] text-slate-500">{ticket.ticketNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            aria-label="Đóng"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {!hasVitals && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Bệnh nhân này CHƯA được đo dấu hiệu sinh tồn!
            </p>
          )}

          <p className="text-sm leading-relaxed text-slate-700">
            {hasVitals
              ? `Xác nhận hoàn tất đo sinh hiệu & tiếp nhận điều dưỡng cho phiếu ${ticket.ticketNumber} (${patientName})?`
              : `Phiếu ${ticket.ticketNumber} (${patientName}) chưa có chỉ số sinh hiệu. Bạn có muốn đo sinh hiệu ngay trước khi hoàn tất không?`}
          </p>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hủy
            </button>

            {hasVitals ? (
              <button
                type="button"
                onClick={onComplete}
                disabled={isBusy}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={16} aria-hidden="true" />
                )}
                Xác nhận hoàn tất
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onComplete}
                  disabled={isBusy}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Vẫn hoàn tất (Chưa đo)
                </button>
                <button
                  type="button"
                  onClick={onMeasure}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <HeartPulse size={16} aria-hidden="true" />
                  Đo sinh hiệu ngay
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
