import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useDrugCatalog } from "../../../hooks/useDrugCatalog";
import { drugToRxLine } from "../data/rxMapper";
import type { Allergy, RxLine } from "../data/doctorMockData";

interface PrescriptionDraftTableProps {
  rxLines: RxLine[];
  setRxLines: React.Dispatch<React.SetStateAction<RxLine[]>>;
  allergies: Allergy[];
}

export default function PrescriptionDraftTable({
  rxLines,
  setRxLines,
  allergies,
}: PrescriptionDraftTableProps) {
  // The live formulary replaces the seeded PHARMACY_FORMULARY: stock, BHYT
  // coverage and the penicillin flag of every line come from the kho.
  const catalog = useDrugCatalog();
  const [selectedDrugId, setSelectedDrugId] = useState<number | null>(null);
  const selectedDrug =
    catalog.drugs.find((drug) => drug.id === selectedDrugId) ??
    catalog.drugs[0] ??
    null;

  function addMedicine() {
    if (!selectedDrug) return;
    const newLine = drugToRxLine(selectedDrug, `RX-${Date.now()}`);
    setRxLines((prev) => [...prev, newLine]);
  }

  function updateLine(id: string, patch: Partial<RxLine>) {
    setRxLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  const hasPenicillinAllergy = allergies.some((a) =>
    a.name.toLowerCase().includes("penicillin"),
  );
  const hasPenicillinRx = rxLines.some((line) => line.isPenicillinClass);
  const showConflictWarning = hasPenicillinAllergy && hasPenicillinRx;
  const lowStockLines = rxLines.filter(
    (line) => line.quantity > line.stockUnits,
  );

  return (
    <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Bảng Kê Đơn Thuốc
        </p>
        <span className="rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-teal-700">
          Đề xuất AI
        </span>
      </div>

      {showConflictWarning && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          ⚠️ CẢNH BÁO DỊ ỨNG: Bệnh nhân có tiền sử dị ứng với Penicillin! Vui
          lòng thay thế bằng nhóm kháng sinh khác.
        </div>
      )}

      {lowStockLines.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          ⚠️ KHO KHÔNG ĐỦ: {lowStockLines.map((line) => line.medication).join(", ")}{" "}
          - số lượng kê vượt tồn kho hiện tại, hệ thống sẽ từ chối xuất kho.
        </div>
      )}

      <table className="mt-2 w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] font-semibold text-slate-500">
            <th className="py-1.5 pr-2">Tên Thuốc &amp; Hoạt chất</th>
            <th className="py-1.5 pr-2">Dạng bào chế</th>
            <th className="py-1.5 pr-2">Cách dùng &amp; Tần suất</th>
            <th className="py-1.5 pr-2">Liều dùng</th>
            <th className="py-1.5 pr-2">SL</th>
            <th className="py-1.5 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rxLines.map((line) => {
            const lowStock = line.stockUnits < 30;
            const overStock = line.quantity > line.stockUnits;
            return (
              <tr key={line.id} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-2">
                  <p className="font-semibold text-slate-900">
                    {line.medication}
                  </p>
                  <span
                    className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      overStock
                        ? "border border-red-200 bg-red-50 text-red-700"
                        : lowStock
                          ? "border border-amber-200 bg-amber-50 text-amber-700"
                          : "border border-teal-200 bg-teal-50 text-teal-700"
                    }`}
                  >
                    ● {overStock ? "Không đủ tồn" : lowStock ? "Sắp hết" : "Còn hàng"}:{" "}
                    {line.stockUnits} đơn vị
                  </span>
                  <span className="mt-0.5 ml-1 inline-block rounded-full border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                    ● {line.bhytCoverage}
                  </span>
                </td>
                <td className="py-2 pr-2 text-slate-600">
                  {line.dosageForm}
                </td>
                <td className="py-2 pr-2">
                  <input
                    value={line.routeFrequency}
                    onChange={(e) =>
                      updateLine(line.id, { routeFrequency: e.target.value })
                    }
                    className="h-8 w-full rounded border border-slate-200 px-2 text-xs text-slate-700 focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="py-2 pr-2 text-slate-600">{line.duration}</td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.id, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="h-8 w-16 rounded border border-slate-200 px-2 text-xs text-slate-700 focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setRxLines((prev) =>
                        prev.filter((item) => item.id !== line.id),
                      )
                    }
                    aria-label={`Xóa ${line.medication}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
          {rxLines.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-slate-400">
                Chưa có thuốc nào được kê.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Add medicine */}
      <div className="mt-2 flex items-center gap-2">
        <select
          value={selectedDrug ? String(selectedDrug.id) : ""}
          onChange={(e) => setSelectedDrugId(Number(e.target.value))}
          disabled={catalog.drugs.length === 0}
          aria-label="Chọn thuốc trong danh mục kho"
          className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-teal-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
        >
          {catalog.drugs.map((drug) => (
            <option key={drug.id} value={drug.id}>
              {drug.name} {drug.concentration} ({drug.dosageForm}) — Còn{" "}
              {drug.stockQuantity} đơn vị
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addMedicine}
          disabled={!selectedDrug}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal-600 bg-teal-50 px-3 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-600 hover:text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {catalog.isLoading
            ? "Đang tải danh mục..."
            : "Thêm thuốc vào đơn"}
        </button>
      </div>

      {catalog.error && (
        <p className="mt-1 text-[11px] text-red-600">
          {catalog.isUnavailable
            ? `Không tải được danh mục thuốc: ${catalog.error}`
            : "Danh mục thuốc có thể đã cũ, hãy bấm Thêm thuốc để nạp lại."}
        </p>
      )}
    </div>
  );
}
