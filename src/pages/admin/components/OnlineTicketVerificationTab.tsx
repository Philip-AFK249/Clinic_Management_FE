import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TicketCheck,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../context/useAuth";
import {
  approveOnlineTicketApi,
  getPendingOnlineTicketsApi,
  rejectOnlineTicketApi,
} from "../../../services/intakeApi";
import type { QueueStatus, QueueTicketDetailResponse } from "../../../services/intakeApi";
import { NO_CANCEL_POLICY_NOTICE } from "../../patient/data/ticketLifecycle";

const POLL_INTERVAL_MS = 5_000;

interface StatusMeta {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
}

const STATUS_META: Record<QueueStatus, StatusMeta> = {
  PENDING_CONFIRMATION: {
    label: "Chờ duyệt",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: CreditCard,
  },
  WAITING: {
    label: "Đã duyệt (Vé chính thức)",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Đã từ chối",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: XCircle,
  },
  CALLED: {
    label: "Đã gọi khám",
    className: "border-clinical-200 bg-clinical-50 text-clinical-700",
    icon: CheckCircle2,
  },
  IN_CONSULTATION: {
    label: "Đang khám",
    className: "border-teal-200 bg-teal-50 text-teal-700",
    icon: CheckCircle2,
  },
  COMPLETED: {
    label: "Đã hoàn tất",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  SKIPPED: {
    label: "Đã bỏ lỡ",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: XCircle,
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: XCircle,
  },
};

function StatusBadge({ status }: { status: QueueStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function PaymentBadge({ ticket }: { ticket: QueueTicketDetailResponse }) {
  const paid = ticket.isReceiptVerified === true;
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
          paid
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-50 text-slate-600"
        }`}
      >
        <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
        {paid ? "Đã thanh toán" : "Chưa thanh toán"}
      </span>
      {paid && ticket.paidAt ? (
        <span className="text-[10px] text-slate-400">
          {new Date(ticket.paidAt).toLocaleString("vi-VN")}
        </span>
      ) : null}
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

interface TicketActionsProps {
  ticket: QueueTicketDetailResponse;
  adminName: string;
  busy: boolean;
  onApprove: (ticket: QueueTicketDetailResponse) => void;
  onReject: (ticket: QueueTicketDetailResponse, reason: string) => void;
}

function TicketActions({
  ticket,
  adminName,
  busy,
  onApprove,
  onReject,
}: TicketActionsProps) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  if (ticket.status === "WAITING") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 size={14} aria-hidden="true" />
        Đã xác thực bởi {adminName}
      </p>
    );
  }
  if (ticket.status === "REJECTED") {
    return (
      <div className="text-xs text-rose-700">
        <p className="font-semibold">Đã từ chối bởi {adminName}</p>
        {ticket.rejectionReason ? <p className="mt-0.5">Lý do: {ticket.rejectionReason}</p> : null}
      </div>
    );
  }
  if (ticket.status !== "PENDING_CONFIRMATION") {
    return <span className="text-xs text-slate-400">—</span>;
  }

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
          {busy ? "Đang xử lý..." : "Duyệt"}
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
      {showReason ? (
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
      ) : null}
    </div>
  );
}

/**
 * Admin's online-ticket verification board.
 *
 * Every 5 seconds the board asks the queue service for pending tickets. Local
 * decisions are merged into that answer instead of being discarded: an
 * approved or rejected row stays visible for the rest of the session, with its
 * status and read-only action label updated in place.
 */
export default function OnlineTicketVerificationTab() {
  const { user } = useAuth();
  const adminName = user?.fullName ?? "Admin";
  const [tickets, setTickets] = useState<QueueTicketDetailResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTicket, setBusyTicket] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const list = await getPendingOnlineTicketsApi(signal);
      if (signal?.aborted) return;
      setTickets((current) => {
        const byNumber = new Map(
          current.map((ticket) => [ticket.ticketNumber, ticket]),
        );
        const retained = [...byNumber.values()].filter(
          (ticket) => ticket.status !== "PENDING_CONFIRMATION",
        );
        const merged = list.map((ticket) => {
          const decided = byNumber.get(ticket.ticketNumber);
          return decided && decided.status !== "PENDING_CONFIRMATION"
            ? decided
            : ticket;
        });
        for (const ticket of retained) {
          if (!list.some((item) => item.ticketNumber === ticket.ticketNumber)) {
            merged.push(ticket);
          }
        }
        return merged.sort((left, right) =>
          left.ticketNumber.localeCompare(right.ticketNumber),
        );
      });
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
      const updated = await approveOnlineTicketApi(ticket.ticketNumber, adminName);
      // Keep the row and flip it in place - the approved ticket must stay on
      // this board so reception can see it was verified by this admin.
      setTickets((current) =>
        current.map((item) =>
          item.ticketNumber === ticket.ticketNumber
            ? {
                ...item,
                ...updated,
                status: "WAITING",
                confirmedBy: updated.confirmedBy ?? adminName,
                confirmedAt: updated.confirmedAt ?? new Date().toISOString(),
              }
            : item,
        ),
      );
      toast.success(
        `Đã xác thực vé ${ticket.ticketNumber} thành VÉ ONLINE CHÍNH THỨC!`,
        { duration: 5000 },
      );
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
      const updated = await rejectOnlineTicketApi(
        ticket.ticketNumber,
        reason,
        adminName,
      );
      setTickets((current) =>
        current.map((item) =>
          item.ticketNumber === ticket.ticketNumber
            ? {
                ...item,
                ...updated,
                status: "REJECTED",
                rejectionReason:
                  reason.trim() || updated.rejectionReason || item.rejectionReason || null,
              }
            : item,
        ),
      );
      toast.error(
        `Đã từ chối vé ${ticket.ticketNumber}. Khung giờ đã được hoàn trả; tài khoản bệnh nhân bị tạm khóa đặt lại trong 03 phút.${
          reason.trim() ? ` Lý do: ${reason.trim()}` : ""
        }`,
        { duration: 7000 },
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không từ chối được vé online.",
      );
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
            Vé online chờ kiểm tra thanh toán · tự động làm mới mỗi 5 giây · Admin
            không bị giới hạn thời gian duyệt
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

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-clinical-200 bg-clinical-50 p-4">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-clinical-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-clinical-900">Kiểm tra thanh toán</p>
            <p className="mt-1 text-xs leading-relaxed text-clinical-800">
              Chỉ duyệt vé khi trạng thái thanh toán hiển thị <strong>Đã thanh toán</strong>.
              Từ chối vé sẽ giải phóng khung giờ và tạm khóa đặt lịch của bệnh nhân 3 phút.
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

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-rose-800">Không tải được danh sách vé</p>
            <p className="mt-1 text-xs leading-relaxed text-rose-700">{error}</p>
          </div>
        </div>
      ) : null}

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
            Các vé mới đặt sẽ xuất hiện tại đây ngay lập tức.
          </p>
        </div>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <TicketCheck size={12} className="text-clinical-600" aria-hidden="true" />
            {tickets.length} vé trên bảng xác thực
          </p>

          {/* Table for wide screens */}
          <div className="hidden overflow-hidden rounded-xl border border-surface-border bg-white shadow-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-surface-border bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Mã vé (#A-xxx)</th>
                    <th className="px-3 py-3">Bệnh nhân &amp; liên lạc</th>
                    <th className="px-3 py-3">Chuyên khoa / Bác sĩ</th>
                    <th className="px-3 py-3">Lịch hẹn</th>
                    <th className="px-3 py-3">Thanh toán</th>
                    <th className="px-3 py-3">Trạng thái</th>
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
                        <p className="font-semibold">{ticket.slotStartTime.slice(0, 5)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <PaymentBadge ticket={ticket} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="px-3 py-3">
                        <TicketActions
                          ticket={ticket}
                          adminName={adminName}
                          busy={busyTicket === ticket.ticketNumber}
                          onApprove={(item) => void handleApprove(item)}
                          onReject={(item, value) => void handleReject(item, value)}
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {ticket.ticketNumber}
                  </span>
                  <StatusBadge status={ticket.status} />
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
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <PaymentBadge ticket={ticket} />
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <TicketActions
                    ticket={ticket}
                    adminName={adminName}
                    busy={busyTicket === ticket.ticketNumber}
                    onApprove={(item) => void handleApprove(item)}
                    onReject={(item, value) => void handleReject(item, value)}
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
