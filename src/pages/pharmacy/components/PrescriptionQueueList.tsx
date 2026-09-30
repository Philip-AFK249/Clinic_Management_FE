import { useState } from "react";
import { Clock, ChevronRight } from "lucide-react";
import type { PharmacyOrder, PrescriptionStatus } from "../data/pharmacyTypes";

interface PrescriptionQueueListProps {
  orders: PharmacyOrder[];
  selectedOrderId: string;
  onSelect: (orderId: string) => void;
}

type QueueFilter = "ALL" | PrescriptionStatus;

const FILTER_TABS: { key: QueueFilter; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING_PREPARATION", label: "Chờ soạn" },
  { key: "PREPARING", label: "Đang soạn" },
  { key: "READY_FOR_PICKUP", label: "Chờ phát" },
  { key: "DISPENSED", label: "Đã phát" },
  { key: "CANCELLED", label: "Đã hủy" },
];

const STATUS_BADGES: Record<
  PrescriptionStatus,
  { label: string; className: string }
> = {
  PENDING_PREPARATION: {
    label: "Chờ soạn thuốc",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  PREPARING: {
    label: "Đang soạn thuốc",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  READY_FOR_PICKUP: {
    label: "Sẵn sàng phát",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  DISPENSED: {
    label: "Đã hoàn tất",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  CANCELLED: {
    label: "Đơn đã hủy",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

const PAYMENT_BADGES: Record<
  PharmacyOrder["paymentStatus"],
  { label: string; className: string }
> = {
  PAID_ONLINE: {
    label: "✓ Đã thanh toán",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  PENDING_AT_COUNTER: {
    label: "⏳ Chờ thu tại quầy",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  SETTLED_AT_COUNTER: {
    label: "✓ Đã thu tại quầy",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

export default function PrescriptionQueueList({
  orders,
  selectedOrderId,
  onSelect,
}: PrescriptionQueueListProps) {
  const [filter, setFilter] = useState<QueueFilter>("ALL");

  const countFor = (filterKey: QueueFilter) =>
    filterKey === "ALL"
      ? orders.length
      : orders.filter((order) => order.status === filterKey).length;

  const filtered =
    filter === "ALL"
      ? orders
      : orders.filter((order) => order.status === filter);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200/80 bg-white">
      {/* Header + filter tabs */}
      <div className="border-b border-slate-200/80 px-3 py-2.5">
        <p className="text-sm font-bold text-slate-900">Hàng đợi Đơn thuốc</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                filter === tab.key
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1 text-[10px] font-bold ${
                  filter === tab.key
                    ? "bg-white/25 text-white"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {countFor(tab.key)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">
            Không có đơn thuốc nào trong nhóm này.
          </p>
        )}
        {filtered.map((order) => {
          const statusBadge = STATUS_BADGES[order.status];
          const payBadge = PAYMENT_BADGES[order.paymentStatus];
          const selected = order.orderId === selectedOrderId;
          return (
            <button
              key={order.orderId}
              type="button"
              onClick={() => onSelect(order.orderId)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                selected
                  ? "border-emerald-500 bg-emerald-50/60 shadow-card"
                  : "border-slate-200/80 bg-white shadow-card hover:border-emerald-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  Mã đơn #{order.orderId}
                </span>
                <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {order.createdAt}
                </span>
              </div>
              <span
                className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge.className}`}
              >
                {statusBadge.label}
              </span>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">
                {order.patientName}
                {order.age !== null && (
                  <span className="font-normal text-slate-500">
                    {" "}
                    ({order.age}T, {order.gender ?? "—"})
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                Bác sĩ: {order.prescribingDoctor}
                {order.roomNumber ? ` (${order.roomNumber})` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  ✓ BHYT {order.isOcrVerified ? order.items[0]?.bhytCoveragePercent ?? 80 : 0}%
                </span>
                <span
                  className={`inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${payBadge.className}`}
                >
                  {payBadge.label}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {order.items.length} loại thuốc
              </p>
              {selected && (
                <span className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  Đang soạn <ChevronRight className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
