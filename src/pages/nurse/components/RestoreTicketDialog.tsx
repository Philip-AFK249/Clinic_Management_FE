import { Loader2, RotateCcw, X } from "lucide-react";
import type { QueueTicket } from "../../../services/intakeApi";

interface RestoreTicketDialogProps {
  ticket: QueueTicket;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function RestoreTicketDialog({
  ticket,
  isBusy,
  onClose,
  onConfirm,
}: RestoreTicketDialogProps) {
  const patientName = ticket.patient?.fullName ?? "Không rõ họ tên";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Khôi phục phiếu ${ticket.ticketNumber}`}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200/80 bg-white shadow-elevated">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Khôi phục phiếu chờ
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
          <p className="text-sm leading-relaxed text-slate-700">
            Khôi phục phiếu {ticket.ticketNumber} ({patientName}) về hàng đợi
            Đang chờ?
          </p>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw size={16} aria-hidden="true" />
              )}
              Khôi phục chờ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
