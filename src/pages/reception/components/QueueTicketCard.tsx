import { Ban, Clock, DoorOpen, PhoneCall, Printer, SkipForward } from "lucide-react";
import type { QueueStatus, QueueTicket } from "../../../services/intakeApi";
import { QUEUE_STATUS_META, estimateWaitMinutes, triageMeta } from "../data/receptionMockData";

interface QueueTicketCardProps {
  ticket: QueueTicket;
  patientsAhead: number;
  isMutating: boolean;
  onChangeStatus: (ticketNumber: string, status: QueueStatus) => void;
  onPrint: (ticket: QueueTicket) => void;
}

function timeLabel(iso: string | null): string {
  if (!iso) return "--:--";
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : "--:--";
}

export default function QueueTicketCard({
  ticket,
  patientsAhead,
  isMutating,
  onChangeStatus,
  onPrint,
}: QueueTicketCardProps) {
  const triage = triageMeta(ticket.priorityLevel);
  const status = QUEUE_STATUS_META[ticket.status];
  const waitMinutes = estimateWaitMinutes(patientsAhead);
  const insurance = ticket.patient?.insuranceCode ?? null;
  const identity = ticket.patient?.identityCardNumber ?? null;
  const canAct = QUEUE_STATUS_META[ticket.status].actionable;

  return (
    <article
      className={`rounded-xl border bg-white p-3 shadow-card transition-colors ${
        ticket.priorityLevel === "P1"
          ? "border-l-4 border-red-500 border-y-slate-200 border-r-slate-200"
          : "border-slate-200/80"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${triage.chipClass}`}
          >
            {triage.label}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.chipClass}`}
          >
            {status.label}
          </span>
        </div>
        <span className="font-mono text-sm font-bold text-slate-900">
          {ticket.ticketNumber}
        </span>
      </div>

      <p className="mt-1.5 truncate text-sm font-bold text-slate-900">
        {ticket.patient?.fullName ?? "Không rõ họ tên"}
      </p>

      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div className="min-w-0">
          <dt className="text-slate-400">Bác sĩ phụ trách</dt>
          <dd className="truncate font-semibold text-slate-700" title={ticket.doctorName}>
            {ticket.doctorName}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-400">Phòng khám</dt>
          <dd className="flex items-center gap-1 truncate font-semibold text-slate-700">
            <DoorOpen className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
            {ticket.roomNumber}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-400">Khung giờ</dt>
          <dd className="font-mono font-semibold text-slate-700">
            {ticket.slotStartTime.slice(0, 5)} &middot; đến lúc{" "}
            {timeLabel(ticket.checkInTime)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-400">Ước tính chờ</dt>
          <dd className="flex items-center gap-1 font-semibold text-slate-700">
            <Clock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
            {waitMinutes} phút &middot; {patientsAhead} người trước
          </dd>
        </div>
      </dl>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {insurance && (
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
            {insurance}
          </span>
        )}
        {identity && (
          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
            CCCD {identity}
          </span>
        )}
        {ticket.patient?.isOcrVerified && (
          <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            OCR
          </span>
        )}
      </div>

      {ticket.chiefComplaint && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
          {ticket.chiefComplaint}
        </p>
      )}

      <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
        <button
          type="button"
          disabled={!canAct || isMutating}
          onClick={() => onChangeStatus(ticket.ticketNumber, "CALLED")}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-teal-600 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          <PhoneCall className="h-3 w-3" aria-hidden="true" />
          Gọi
        </button>
        <button
          type="button"
          disabled={!canAct || isMutating}
          onClick={() => onChangeStatus(ticket.ticketNumber, "SKIPPED")}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-300 px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SkipForward className="h-3 w-3" aria-hidden="true" />
          Bỏ qua
        </button>
        <button
          type="button"
          disabled={!canAct || isMutating}
          onClick={() => onChangeStatus(ticket.ticketNumber, "CANCELLED")}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-300 px-2 text-[11px] font-semibold text-slate-600 transition-colors hover:border-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Ban className="h-3 w-3" aria-hidden="true" />
          Huỷ
        </button>
        <button
          type="button"
          onClick={() => onPrint(ticket)}
          aria-label={`In lại phiếu ${ticket.ticketNumber}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 transition-colors hover:bg-slate-50 hover:text-teal-700"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
