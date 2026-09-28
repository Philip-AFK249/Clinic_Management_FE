import { useMemo, useState } from "react";
import {
  Activity,
  Loader2,
  RefreshCw,
  Radio,
  Users,
  WifiOff,
} from "lucide-react";
import QueueTicketCard from "./QueueTicketCard";
import type { QueueStatus, QueueTicket } from "../../../services/intakeApi";
import { patientsAhead } from "../../../services/intakeApi";
import { RECEPTION_DEPARTMENTS } from "../data/receptionMockData";
import type { QueueScope } from "../hooks/useReceptionQueue";

interface QueueMonitorPanelProps {
  tickets: QueueTicket[];
  waitingCount: number;
  emergencyCount: number;
  isLoading: boolean;
  isMutating: boolean;
  isOffline: boolean;
  error: string;
  lastUpdatedAt: Date | null;
  onRefresh: () => void;
  onChangeStatus: (ticketNumber: string, status: QueueStatus) => void;
  onPrint: (ticket: QueueTicket) => void;
}

export default function QueueMonitorPanel({
  tickets,
  waitingCount,
  emergencyCount,
  isLoading,
  isMutating,
  isOffline,
  error,
  lastUpdatedAt,
  onRefresh,
  onChangeStatus,
  onPrint,
}: QueueMonitorPanelProps) {
  const [scope, setScope] = useState<QueueScope>("ALL");

  const visible = useMemo(
    () =>
      scope === "ALL"
        ? tickets
        : tickets.filter((ticket) => ticket.departmentId === scope),
    [scope, tickets],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {/* Monitor header */}
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-white">
              <Radio className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-bold leading-tight text-slate-900">
                Màn Hình Hàng Đợi Trực Tiếp
              </h2>
              <p className="text-[11px] text-slate-500">
                {waitingCount} đang chờ
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
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot" aria-hidden="true" />
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

        {/* Department filter tabs */}
        <div
          role="tablist"
          aria-label="Lọc hàng đợi theo chuyên khoa"
          className="mt-2.5 flex flex-wrap gap-1"
        >
          <FilterTab
            active={scope === "ALL"}
            label="Tất cả khoa"
            onClick={() => setScope("ALL")}
          />
          {RECEPTION_DEPARTMENTS.map((department) => (
            <FilterTab
              key={department.id}
              active={scope === department.id}
              label={department.shortName}
              onClick={() => setScope(department.id)}
            />
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
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="h-[168px] animate-pulse rounded-xl border border-slate-200/80 bg-white"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Users className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-slate-700">
              Hàng đợi đang trống
            </p>
            <p className="max-w-[240px] text-xs text-slate-500">
              Chưa có bệnh nhân nào chờ khám tại khoa này. Phiếu mới cấp sẽ tự
              động xuất hiện trong vòng 10 giây.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((ticket) => (
              <QueueTicketCard
                key={ticket.ticketNumber}
                ticket={ticket}
                patientsAhead={patientsAhead(ticket, tickets)}
                isMutating={isMutating}
                onChangeStatus={onChangeStatus}
                onPrint={onPrint}
              />
            ))}
          </div>
        )}
      </div>

      {/* Monitor footer */}
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

function FilterTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-full px-3 text-[11px] font-semibold transition-colors ${
        active
          ? "bg-slate-800 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}
