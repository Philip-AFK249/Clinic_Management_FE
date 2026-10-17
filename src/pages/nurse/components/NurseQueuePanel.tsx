import { useMemo, useState } from "react";
import {
  Activity,
  ClipboardCheck,
  DoorOpen,
  HeartPulse,
  Loader2,
  RefreshCw,
  Stethoscope,
  Users,
  WifiOff,
} from "lucide-react";
import type { QueueStatus, QueueTicket } from "../../../services/intakeApi";
import { patientsAhead } from "../../../services/intakeApi";
import {
  QUEUE_STATUS_META,
  estimateWaitMinutes,
  triageMeta,
} from "../../reception/data/receptionMockData";
import {
  clockLabel,
  nurseQueueActions,
  vitalsSummary,
} from "../data/nurseStation";
import type { NurseQueueAction, VitalsRecord } from "../data/nurseStation";

type QueueFilter = "ALL" | "WAITING" | "ACTIVE" | "DONE";

interface NurseQueuePanelProps {
  /** Department-scoped, already ordered by `sortNurseQueue`. */
  tickets: QueueTicket[];
  date: string;
  waitingCount: number;
  emergencyCount: number;
  vitals: Record<string, VitalsRecord>;
  isLoading: boolean;
  isMutating: boolean;
  isOffline: boolean;
  error: string;
  lastUpdatedAt: Date | null;
  onRefresh: () => void;
  onChangeStatus: (ticketNumber: string, status: QueueStatus) => void;
  onCaptureVitals: (ticket: QueueTicket) => void;
}

const FILTERS: { key: QueueFilter; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "WAITING", label: "Đang chờ" },
  { key: "ACTIVE", label: "Đang xử lý" },
  { key: "DONE", label: "Hoàn tất" },
];

function isActiveStatus(status: QueueStatus): boolean {
  return status === "CALLED" || status === "IN_CONSULTATION";
}

function dateLabelFrom(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

const ACTION_TONES: Record<NurseQueueAction["tone"], string> = {
  primary:
    "bg-violet-600 text-white hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-500",
  outline:
    "border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40",
  danger:
    "border border-slate-300 text-rose-600 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-40",
};

/**
 * The nurse's working queue: everything waiting at this khoa, ordered by
 * triage, with the status transitions a điều dưỡng actually performs plus the
 * vitals capture that precedes hand-over to the bác sĩ.
 */
export default function NurseQueuePanel({
  tickets,
  date,
  waitingCount,
  emergencyCount,
  vitals,
  isLoading,
  isMutating,
  isOffline,
  error,
  lastUpdatedAt,
  onRefresh,
  onChangeStatus,
  onCaptureVitals,
}: NurseQueuePanelProps) {
  const [filter, setFilter] = useState<QueueFilter>("ALL");

  const visible = useMemo(() => {
    switch (filter) {
      case "WAITING":
        return tickets.filter((ticket) => ticket.status === "WAITING");
      case "ACTIVE":
        return tickets.filter((ticket) => isActiveStatus(ticket.status));
      case "DONE":
        return tickets.filter(
          (ticket) =>
            ticket.status === "COMPLETED" ||
            ticket.status === "SKIPPED" ||
            ticket.status === "CANCELLED",
        );
      default:
        return tickets;
    }
  }, [tickets, filter]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {/* Panel header */}
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white">
              <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-bold leading-tight text-slate-900">
                Hàng Đợi Khám Của Khoa
              </h2>
              <p className="text-[11px] text-slate-500">
                Ngày {dateLabelFrom(date)} &middot; {waitingCount} đang chờ
                {emergencyCount > 0 && (
                  <span className="font-semibold text-red-600">
                    {" "}
                    &middot; {emergencyCount} khẩn cấp
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                isOffline
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {isOffline ? (
                <WifiOff className="h-3 w-3" aria-hidden="true" />
              ) : isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot"
                  aria-hidden="true"
                />
              )}
              {isOffline
                ? "Dữ liệu mô phỏng"
                : isLoading
                  ? "Đang tải hàng đợi"
                  : "Dữ liệu trực tiếp"}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              aria-label="Làm mới hàng đợi"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Lọc hàng đợi theo trạng thái"
          className="mt-2.5 flex flex-wrap gap-1"
        >
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={filter === option.key}
              onClick={() => setFilter(option.key)}
              className={`inline-flex h-8 items-center rounded-full px-3 text-[11px] font-semibold transition-colors ${
                filter === option.key
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
            {error}
          </p>
        )}
      </div>

      {/* Ticket list */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-light p-3">
        {isLoading && tickets.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-xl border border-slate-200/80 bg-white"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Users className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-slate-700">
              Không có phiếu nào trong mục này
            </p>
            <p className="max-w-[260px] text-xs text-slate-500">
              Phiếu mới từ quầy tiếp đón tự xuất hiện trong vòng 10 giây.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((ticket) => (
              <NurseTicketCard
                key={ticket.ticketNumber}
                ticket={ticket}
                patientsAhead={patientsAhead(ticket, tickets)}
                isMutating={isMutating}
                record={vitals[ticket.ticketNumber]}
                onChangeStatus={onChangeStatus}
                onCaptureVitals={onCaptureVitals}
              />
            ))}
          </div>
        )}
      </div>

      {/* Panel footer */}
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-slate-200/80 bg-white px-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <Activity className="h-3 w-3" aria-hidden="true" />
          Tự đồng bộ mỗi 10 giây
        </span>
        <span>
          {lastUpdatedAt
            ? `Cập nhật lúc ${lastUpdatedAt.toLocaleTimeString("vi-VN", { hour12: false })}`
            : "Chưa đồng bộ"}
        </span>
      </div>
    </section>
  );
}

interface NurseTicketCardProps {
  ticket: QueueTicket;
  patientsAhead: number;
  isMutating: boolean;
  record?: VitalsRecord;
  onChangeStatus: (ticketNumber: string, status: QueueStatus) => void;
  onCaptureVitals: (ticket: QueueTicket) => void;
}

function NurseTicketCard({
  ticket,
  patientsAhead: ahead,
  isMutating,
  record,
  onChangeStatus,
  onCaptureVitals,
}: NurseTicketCardProps) {
  const triage = triageMeta(ticket.priorityLevel);
  const status = QUEUE_STATUS_META[ticket.status];
  const actions = nurseQueueActions(ticket.status);
  const summary = vitalsSummary(record);

  return (
    <article
      className={`rounded-xl border bg-white p-3 shadow-card ${
        ticket.priorityLevel === "P1"
          ? "border-l-4 border-red-500 border-y-slate-200 border-r-slate-200"
          : "border-slate-200/80"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${triage.chipClass}`}>
            {triage.label}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.chipClass}`}>
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
          <dd className="flex items-center gap-1 truncate font-semibold text-slate-700">
            <Stethoscope className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
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
            {ticket.slotStartTime.slice(0, 5)} &middot; {clockLabel(ticket.checkInTime)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-400">Ước tính chờ</dt>
          <dd className="font-semibold text-slate-700">
            {estimateWaitMinutes(ahead)} phút &middot; {ahead} người trước
          </dd>
        </div>
      </dl>

      {ticket.chiefComplaint && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
          {ticket.chiefComplaint}
        </p>
      )}

      {/* Vitals readout */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {summary.length > 0 ? (
          <>
            {summary.map((line) => (
              <span
                key={line}
                className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"
              >
                {line}
              </span>
            ))}
            <span className="text-[10px] text-slate-400">
              {clockLabel(record!.recordedAt)} &middot; {record!.recordedBy}
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            <HeartPulse className="h-3 w-3" aria-hidden="true" />
            Chưa đo sinh hiệu
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
        <button
          type="button"
          disabled={isMutating}
          onClick={() => onCaptureVitals(ticket)}
          className="inline-flex h-8 min-w-[7.5rem] flex-1 items-center justify-center gap-1 rounded-md border border-violet-300 bg-violet-50 px-1 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <HeartPulse className="h-3.5 w-3.5" aria-hidden="true" />
          {record ? "Sửa sinh hiệu" : "Đo sinh hiệu"}
        </button>
        {actions.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={isMutating}
            onClick={() => onChangeStatus(ticket.ticketNumber, action.status)}
            className={`inline-flex h-8 items-center justify-center rounded-md px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${ACTION_TONES[action.tone]}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </article>
  );
}
