import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import type { PharmacyOrder } from "../data/pharmacyTypes";

interface MedicationPackingTrayProps {
  order: PharmacyOrder;
  onToggleItem: (itemId: string) => void;
}

const STATUS_LABELS: Record<PharmacyOrder["status"], string> = {
  PENDING_PREPARATION: "Chờ soạn thuốc",
  PREPARING: "Đang soạn thuốc",
  READY_FOR_PICKUP: "Sẵn sàng phát",
  DISPENSED: "Đã hoàn tất",
  CANCELLED: "Đơn đã hủy",
};

const COVERAGE_LABELS: Record<number, string> = {
  0: "Tự túc",
  80: "BHYT 80%",
  100: "BHYT 100%",
};

function isAllPacked(order: PharmacyOrder) {
  return order.items.length > 0 && order.items.every((i) => i.isPacked);
}

export default function MedicationPackingTray({
  order,
  onToggleItem,
}: MedicationPackingTrayProps) {
  const allPacked = isAllPacked(order);

  function handleToggle(itemId: string) {
    const item = order.items.find((i) => i.id === itemId);
    if (!item) return;
    const becomingPacked = !item.isPacked;
    const nextAllPacked =
      becomingPacked &&
      order.items.every((i) => i.id === itemId || i.isPacked);

    onToggleItem(itemId);

    if (nextAllPacked && order.status !== "READY_FOR_PICKUP") {
      toast.success(
        `Đã hoàn tất soạn khay thuốc #${order.orderId}. Sẵn sàng gọi bệnh nhân ra quầy.`,
        { duration: 4000 },
      );
    }
  }

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck
            className="h-4 w-4 text-emerald-600"
            aria-hidden="true"
          />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Khay Soạn Thuốc - #{order.orderId}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
            allPacked
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {allPacked ? "✓ Đã đối soát đủ" : STATUS_LABELS[order.status]}
        </span>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[11px] font-semibold text-slate-500">
            <th className="w-9 py-2 pl-4 pr-1">Đối soát</th>
            <th className="py-2 pr-2">Tên thuốc &amp; Hoạt chất</th>
            <th className="py-2 pr-2">Dạng bào chế &amp; Liều dùng</th>
            <th className="py-2 pr-2">Tồn kho</th>
            <th className="py-2 pr-2">Số lượng cấp</th>
            <th className="py-2 pr-4">Mức BHYT</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => {
            const coverage = item.bhytCoveragePercent;
            const lowStock = item.stockUnits < item.quantity;
            return (
              <tr
                key={item.id}
                className={`border-b border-slate-100 ${
                  item.isPacked ? "bg-emerald-50/40" : ""
                } ${item.isAllergyRisk ? "bg-red-50/50" : ""}`}
              >
                <td className="py-2.5 pl-4 pr-1">
                  <input
                    type="checkbox"
                    checked={item.isPacked}
                    onChange={() => handleToggle(item.id)}
                    aria-label={`Đối soát ${item.name}`}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </td>
                <td className="py-2.5 pr-2">
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {item.activeIngredient}
                  </p>
                </td>
                <td className="py-2.5 pr-2 text-slate-600">
                  {item.dosageForm}
                  <p className="text-[11px] text-slate-500">
                    {item.instructions}
                  </p>
                </td>
                <td className="py-2.5 pr-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      lowStock ? "text-red-600" : "text-emerald-700"
                    }`}
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                    {lowStock ? "Sắp hết" : "Còn hàng"}: {item.stockUnits} đơn vị
                  </span>
                </td>
                <td className="py-2.5 pr-2 font-bold text-slate-900">
                  {item.quantity} {item.unit}
                </td>
                <td className="py-2.5 pr-4">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    {COVERAGE_LABELS[coverage] ?? `BHYT ${coverage}%`}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}