import { CreditCard, Landmark } from "lucide-react";
import type { PharmacyOrder } from "../data/pharmacyTypes";

interface BillingSummaryCardProps {
  order: PharmacyOrder;
  onGenerateVietQr: () => void;
  onMarkCashSettled: () => void;
}

function formatMoney(value: number): string {
  return `${value.toLocaleString("vi-VN")} đ`;
}

export default function BillingSummaryCard({
  order,
  onGenerateVietQr,
  onMarkCashSettled,
}: BillingSummaryCardProps) {
  // ClinicalConsultationService already applied the per-drug BHYT split server
  // side, so its totals win; the browser figures are only a fallback for orders
  // that predate the live API.
  const computedTotal = order.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const computedInsurance = order.items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unitPrice * (item.bhytCoveragePercent / 100),
    0,
  );

  const totalGross = order.totalAmount ?? computedTotal;
  const bhytCovered = order.insurancePaidAmount ?? computedInsurance;
  const coPay = order.patientCopayAmount ?? totalGross - bhytCovered;

  const settled =
    order.paymentStatus === "PAID_ONLINE" ||
    order.paymentStatus === "SETTLED_AT_COUNTER";

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <CreditCard className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Quyết Toán BHYT &amp; Đồng Chi Trả
        </p>
        {settled ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            ✓ Đã Thanh Toán Qua Cổng Bệnh Nhân
          </span>
        ) : (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
            ⏳ Chờ thanh toán tại quầy
          </span>
        )}
      </div>

      <div className="space-y-1.5 px-4 py-3 text-xs text-slate-600">
        <p className="flex items-center justify-between">
          <span>Tổng tiền thuốc gốc</span>
          <span className="font-bold text-slate-900">
            {formatMoney(totalGross)}
          </span>
        </p>

        <div className="ml-4 space-y-0.5 border-l border-slate-200 pl-3 text-[11px] text-slate-500">
          {order.items.map((item) => (
            <p key={item.id} className="flex justify-between gap-3">
              <span>
                {item.name} ({item.quantity} {item.unit} x{" "}
                {formatMoney(item.unitPrice)})
              </span>
              <span className="font-medium">
                = {formatMoney(item.quantity * item.unitPrice)}
              </span>
            </p>
          ))}
        </div>

        <div className="my-1 border-t border-dashed border-slate-200" />

        <p className="flex items-center justify-between text-emerald-700">
          <span>Quỹ BHYT chi trả (-)</span>
          <span className="font-bold">- {formatMoney(bhytCovered)}</span>
        </p>
        <div className="ml-4 space-y-0.5 border-l border-slate-200 pl-3 text-[11px] text-slate-500">
          {order.items
            .filter((item) => item.bhytCoveragePercent > 0)
            .map((item) => (
              <p key={item.id} className="flex justify-between gap-3">
                <span>
                  {item.name} {item.bhytCoveragePercent}% ={" "}
                  {formatMoney(
                    item.quantity *
                      item.unitPrice *
                      (item.bhytCoveragePercent / 100),
                  )}
                </span>
              </p>
            ))}
        </div>

        <div className="my-1 border-t border-slate-200" />

        <p className="flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-2 text-sm">
          <span className="font-semibold text-emerald-800">
            Số tiền người bệnh đồng chi trả
          </span>
          <span className="font-bold text-emerald-700">
            {formatMoney(coPay)}
          </span>
        </p>
      </div>

      {!settled && (
        <div className="flex flex-col gap-2 border-t border-slate-200/80 px-4 py-3">
          <button
            type="button"
            onClick={onGenerateVietQr}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white"
          >
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            📱 Tạo VietQR Thu Tiền ({formatMoney(coPay)})
          </button>
          <button
            type="button"
            onClick={onMarkCashSettled}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Landmark className="h-4 w-4" aria-hidden="true" />
            💵 Đã Thu Tiền Mặt Tại Quầy
          </button>
        </div>
      )}
    </section>
  );
}