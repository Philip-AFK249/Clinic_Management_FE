import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TicketCheck,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../context/useAuth";
import { useTicketCountdown } from "../../../hooks/useTicketCountdown";
import {
  approveOnlineTicketApi,
  getPendingOnlineTicketsApi,
  rejectOnlineTicketApi,
} from "../../../services/intakeApi";
import type { QueueTicketDetailResponse } from "../../../services/intakeApi";
import {
  formatCountdown,
  NO_CANCEL_POLICY_NOTICE,
  TEMPORARY_HOLD_NOTICE,
} from "../../patient/data/ticketLifecycle";

const POLL_INTERVAL_MS = 5_000;

interface TicketActionsProps {
  ticket: QueueTicketDetailResponse;
  busy: boolean;
  onApprove: (ticket: QueueTicketDetailResponse) => void;
  onReject: (ticket: QueueTicketDetailResponse, reason: string) => void;
}

function CountdownBadge({ ticket }: { ticket: QueueTicketDetailResponse }) {
  const { secondsLeft } = useTicketCountdown(ticket.expiresAt, ticket.checkInTime);
  const urgent = secondsLeft < 45;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${
        urgent
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {formatCountdown(secondsLeft)}
    </span>
  );
}

function TicketActions({ ticket, busy, onApprove, onReject }: TicketActionsProps) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="flex flex-col items-stretch gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onApprove(ticket)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-card transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 size={14} aria-hidden="true" />
          {busy ? "Đang xử lý..." : "Xác thực"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setShowReason((open) => !open)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <XCircle size={14} aria-hidden="true" />
          Từ chối
        </button>
      </div>
      {showReason && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2">
          <label
            className="block text-[11px] font-semibold text-rose-800"
            htmlFor={`reject-reason-${ticket.ticketNumber}`}
          >
            Lý do (không bắt buộc)
          </label>
          <input
            id={`reject-reason-${ticket.ticketNumber}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Thông tin BHYT không khớp"
            className="mt-1 h-9 w-full rounded-md border border-rose-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-rose-400"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onReject(ticket, reason)}
              className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-rose-600 px-2 text-xs font-bold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Xác nhận từ chối
            </button>
            <button
              type="button"
              onClick={() => {
                setShowReason(false);
                setReason("");
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-600 transition-colors hover:bg-rose-100"
              aria-label="Bỏ qua lý do"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactCell({ ticket }: { ticket: QueueTicketDetailResponse }) {
  return (
    <div className="text-xs text-slate-600">
      <p className="font-semibold text-slate-900">{ticket.patientFullName}</p>
      <p>ĐT: {ticket.phone || "—"}</p>
      <p>BHYT: {ticket.insuranceCode || "—"}</p>
      <p>CCCD: {ticket.identityCardNumber || "—"}</p>
    </div>
  );
}

/**
 * Admin queue of temporary online tickets.
 *
 * Every 5 seconds the board asks PatientIntakeService for the tickets still
 * inside their 3-minute hold. Accepting promotes one to an official `WAITING`
 * ticket; rejecting releases its slot. Both actions remove the row at once,
 * ahead of the next poll.
 */
export default function OnlineTicketVerificationTab() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<QueueTicketDetailResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTicket, setBusyTicket] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const list = await getPendingOnlineTicketsApi(signal);
      if (signal?.aborted) return;
      const sorted = [...list].sort((left, right) => {
        const leftMs = Date.parse(left.expiresAt ?? left.checkInTime ?? "");
        const rightMs = Date.parse(right.expiresAt ?? right.checkInTime ?? "");
        return (
          (Number.isNaN(leftMs) ? Number.MAX_SAFE_INTEGER : leftMs) -
          (Number.isNaN(rightMs) ? Number.MAX_SAFE_INTEGER : rightMs)
        );
      });
      setTickets(sorted);
      setError(null);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Không tải được danh sách vé online chờ xác thực.",
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Defer the first fetch to a microtask: the loader sets state after its
    // await, and calling it directly from the effect body trips the React
    // cascading-render guard. Aborting still covers an unmount before it runs.
    queueMicrotask(() => void load(controller.signal));
    const intervalId = window.setInterval(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    }, POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [load]);

  async function handleApprove(ticket: QueueTicketDetailResponse) {
    if (busyTicket !== null) return;
    setBusyTicket(ticket.ticketNumber);
    try {
      await approveOnlineTicketApi(ticket.ticketNumber, user?.fullName);
      setTickets((current) =>
        current.filter((item) => item.ticketNumber !== ticket.ticketNumber),
      );
      toast.success(`Đã xác thực vé ${ticket.ticketNumber} thành vé online chính thức.`, {
        duration: 5000,
      });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không xác thực được vé online.",
      );
    } finally {
      setBusyTicket(null);
    }
  }

  async function handleReject(ticket: QueueTicketDetailResponse, reason: string) {
    if (busyTicket !== null) return;
    setBusyTicket(ticket.ticketNumber);
    try {
      await rejectOnlineTicketApi(ticket.ticketNumber, reason, user?.fullName);
      setTickets((current) =>
        current.filter((item) => item.ticketNumber !== ticket.ticketNumber),
      );
      toast.error(
        `Đã từ chối vé ${ticket.ticketNumber}.${reason.trim() ? ` Lý do: ${reason.trim()}` : ""}`,
        { duration: 6000 },
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Không từ chối được vé online.");
    } finally {
      setBusyTicket(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Xác thực vé Online</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Vé online tạm thời chờ admin kiểm tra · tự động làm mới mỗi 5 giây
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
          Làm mới
        </button>
      </div>

      {/* The rule callout: this is the contract both sides must follow. */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-amber-900">Quy tắc giữ chỗ 03:00</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              {TEMPORARY_HOLD_NOTICE}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-emerald-900">Sau khi xác thực</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800">
              {NO_CANCEL_POLICY_NOTICE}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-rose-800">Không tải được danh sách vé</p>
            <p className="mt-1 text-xs leading-relaxed text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-surface-border bg-white p-12 text-sm text-slate-500 shadow-card">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          Đang tải vé online chờ xác thực...
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-surface-border bg-white p-12 text-center shadow-card">
          <TicketCheck size={32} className="text-emerald-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-700">
            Không có vé online nào chờ xác thực
          </p>
          <p className="max-w-md text-xs leading-relaxed text-slate-500">
            Các vé mới đặt sẽ xuất hiện tại đây ngay lập tức và tự động biến mất
            sau khi bạn xác thực, từ chối hoặc khi hết thời gian giữ chỗ.
          </p>
        </div>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <TicketCheck size={12} className="text-clinical-600" aria-hidden="true" />
            {tickets.length} vé đang chờ · ưu tiên vé sắp hết giờ nhất
          </p>

          {/* Table for wide screens */}
          <div className="hidden overflow-hidden rounded-xl border border-surface-border bg-white shadow-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-surface-border bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Mã vé</th>
                    <th className="px-3 py-3">Bệnh nhân &amp; liên lạc</th>
                    <th className="px-3 py-3">Chuyên khoa / Bác sĩ</th>
                    <th className="px-3 py-3">Lịch hẹn</th>
                    <th className="px-3 py-3">Lý do khám</th>
                    <th className="px-3 py-3">Giữ chỗ</th>
                    <th className="px-3 py-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.ticketNumber}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-3 py-3 font-mono text-xs font-bold text-slate-900">
                        {ticket.ticketNumber}
                      </td>
                      <td className="px-3 py-3">
                        <ContactCell ticket={ticket} />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        <p className="font-semibold">{ticket.departmentName}</p>
                        <p>BS. {ticket.doctorName || "—"}</p>
                        <p className="text-slate-500">{ticket.roomNumber || "—"}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        <p>{ticket.appointmentDate}</p>
                        <p className="font-semibold">
                          {ticket.slotStartTime.slice(0, 5)}
                        </p>
                      </td>
                      <td className="max-w-[220px] px-3 py-3 text-xs leading-relaxed text-slate-600">
                        {ticket.chiefComplaint?.trim() || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <CountdownBadge ticket={ticket} />
                      </td>
                      <td className="px-3 py-3">
                        <TicketActions
                          ticket={ticket}
                          busy={busyTicket === ticket.ticketNumber}
                          onApprove={(item) => void handleApprove(item)}
                          onReject={(item, reason) => void handleReject(item, reason)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards for narrow screens */}
          <div className="space-y-3 md:hidden">
            {tickets.map((ticket) => (
              <article
                key={ticket.ticketNumber}
                className="rounded-xl border border-surface-border bg-white p-4 shadow-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {ticket.ticketNumber}
                  </span>
                  <CountdownBadge ticket={ticket} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <ContactCell ticket={ticket} />
                  <div className="text-xs text-slate-600">
                    <p className="font-semibold text-slate-900">{ticket.departmentName}</p>
                    <p>BS. {ticket.doctorName || "—"} · {ticket.roomNumber || "—"}</p>
                    <p>
                      {ticket.appointmentDate} · {ticket.slotStartTime.slice(0, 5)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <span className="font-semibold text-slate-800">Lý do khám:</span>{" "}
                  {ticket.chiefComplaint?.trim() || "—"}
                </p>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <TicketActions
                    ticket={ticket}
                    busy={busyTicket === ticket.ticketNumber}
                    onApprove={(item) => void handleApprove(item)}
                    onReject={(item, reason) => void handleReject(item, reason)}
                  />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
