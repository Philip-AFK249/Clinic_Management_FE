import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Phone,
  RefreshCw,
  Stethoscope,
  TicketCheck,
  XCircle,
} from "lucide-react";
import { useAppointmentCountdown } from "../../../hooks/useAppointmentCountdown";
import { holdDeadlineMs, secondsUntilDeadline } from "../../../lib/appointmentHold";
import type { PendingApprovalTicket } from "../../../services/intakeApi";
import { usePendingApprovals } from "../hooks/usePendingApprovals";

interface PendingApprovalsBoardProps {
  /** Tighter spacing for the Reception desk's split view. */
  compact?: boolean;
  /** Called after a decision so the caller can refresh its own queue panels. */
  onChanged?: () => void;
}

/**
 * Live board of online bookings whose transfer is waiting for staff approval.
 *
 * Used as the Admin "Pending Approvals" tab and as a compact panel on the
 * Reception desk. The endpoint is polled every three seconds by the shared
 * hook; each row owns its own 1-second countdown so a throttled poll never
 * stretches the three-minute hold.
 */
export default function PendingApprovalsBoard({
  compact = false,
  onChanged,
}: PendingApprovalsBoardProps) {
  const {
    tickets,
    isLoading,
    error,
    lastUpdatedAt,
    busy,
    approve,
    reject,
    refresh,
    isActing,
  } = usePendingApprovals(onChanged);

  return (
    <section
      className={`flex min-h-0 flex-col rounded-xl border border-slate-200/80 bg-white shadow-card ${
        compact ? "h-full" : "flex-1"
      }`}
      aria-labelledby="pending-approvals-heading"
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 ${
          compact ? "px-3 py-2" : "px-6 py-4"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <TicketCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="pending-approvals-heading"
              className={`font-bold tracking-tight text-slate-900 ${compact ? "text-sm" : "text-lg"}`}
            >
              Pending Approvals
            </h2>
            <p className="text-xs text-slate-500">
              Xác nhận chuyển khoản thủ công · Tự cập nhật mỗi 3 giây
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse-dot" />
            {tickets.length} chờ duyệt
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdatedAt && (
            <span className="hidden text-[11px] text-slate-400 sm:inline">
              Cập nhật {lastUpdatedAt.toLocaleTimeString("vi-VN")}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Làm mới
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading && tickets.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-clinical-500" aria-hidden="true" />
            <p className="text-sm">Đang tải phiếu chờ duyệt...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 px-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-700">Không có phiếu nào chờ duyệt</p>
            <p className="text-xs text-slate-500">
              Các lượt đặt lịch chuyển khoản sẽ xuất hiện tại đây ngay khi được tạo.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur">
              <tr>
                <Th>Ticket Number</Th>
                <Th>Patient Name</Th>
                <Th>Phone Number</Th>
                <Th>Department</Th>
                <Th>Doctor</Th>
                <Th>Slot Time</Th>
                <Th>Time Elapsed / Remaining</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((ticket) => (
                <ApprovalRow
                  key={ticket.ticketNumber}
                  ticket={ticket}
                  busy={isActing(ticket.ticketNumber)}
                  busyAction={busy[ticket.ticketNumber]}
                  onApprove={() => void approve(ticket)}
                  onReject={() => void reject(ticket)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`whitespace-nowrap px-3 py-2.5 ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}

interface ApprovalRowProps {
  ticket: PendingApprovalTicket;
  busy: boolean;
  busyAction: "APPROVE" | "REJECT" | undefined;
  onApprove: () => void;
  onReject: () => void;
}

function ApprovalRow({
  ticket,
  busy,
  busyAction,
  onApprove,
  onReject,
}: ApprovalRowProps) {
  const countdown = useAppointmentCountdown({
    holdExpiresAt: ticket.holdExpiresAt,
    remainingSeconds: ticket.remainingSeconds,
    checkInTime: ticket.checkInTime,
    enabled: true,
  });

  // A row can outlive its 3-minute window until the next poll removes it. Show
  // the expired state immediately instead of waiting for the backend to catch up.
  const deadline = holdDeadlineMs({
    holdExpiresAt: ticket.holdExpiresAt,
    remainingSeconds: ticket.remainingSeconds,
    checkInTime: ticket.checkInTime,
  });
  const serverRemaining = deadline === null ? null : secondsUntilDeadline(deadline);
  const remaining =
    serverRemaining !== null && serverRemaining < countdown.remainingSeconds
      ? serverRemaining
      : countdown.remainingSeconds;
  const isUrgent = remaining <= 60;

  return (
    <tr className="transition-colors hover:bg-slate-50/70">
      <Td>
        <span className="whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 font-mono font-bold text-white">
          {ticket.ticketNumber}
        </span>
      </Td>
      <Td className="whitespace-nowrap font-semibold text-slate-800">
        {ticket.patientName}
      </Td>
      <Td className="whitespace-nowrap text-slate-600">
        <span className="inline-flex items-center gap-1">
          <Phone className="h-3 w-3 text-slate-400" aria-hidden="true" />
          {ticket.phone || "—"}
        </span>
      </Td>
      <Td className="whitespace-nowrap text-slate-600">{ticket.departmentName}</Td>
      <Td className="whitespace-nowrap text-slate-600">
        <span className="inline-flex items-center gap-1">
          <Stethoscope className="h-3 w-3 text-slate-400" aria-hidden="true" />
          {ticket.doctorName}
        </span>
      </Td>
      <Td className="whitespace-nowrap text-slate-600">
        {ticket.slotStartTime ? ticket.slotStartTime.slice(0, 5) : "—"}
        {ticket.appointmentDate && (
          <span className="ml-1 text-[10px] text-slate-400">
            {ticket.appointmentDate}
          </span>
        )}
      </Td>
      <Td className="min-w-[150px]">
        <div className="flex items-center gap-1.5">
          <Clock3
            className={`h-3.5 w-3.5 ${isUrgent ? "text-rose-500" : "text-amber-500"}`}
            aria-hidden="true"
          />
          <span
            className={`font-mono font-bold tabular-nums ${
              isUrgent ? "text-rose-600" : "text-amber-700"
            }`}
          >
            {countdown.elapsedLabel}
          </span>
          <span className="text-slate-300">/</span>
          <span
            className={`font-mono font-bold tabular-nums ${
              isUrgent ? "text-rose-600" : "text-slate-700"
            }`}
          >
            {countdown.label}
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isUrgent ? "bg-rose-500" : "bg-amber-400"
            }`}
            style={{ width: `${countdown.progressPercent}%` }}
          />
        </div>
        {isUrgent && (
          <p className="mt-0.5 text-[10px] font-semibold text-rose-600">Sắp hết hạn</p>
        )}
      </Td>
      <Td className="whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            title="Xác nhận đã nhận chuyển khoản"
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && busyAction === "APPROVE" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            ACCEPT
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            title="Từ chối và giải phóng slot"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-[11px] font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && busyAction === "REJECT" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            REJECT
          </button>
        </div>
      </Td>
    </tr>
  );
}
