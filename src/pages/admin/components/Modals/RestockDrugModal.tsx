import { useState } from "react";
import { X, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import type { DrugDto } from "../../../../services/clinicalApi";

interface RestockDrugModalProps {
  isOpen: boolean;
  onClose: () => void;
  drug: DrugDto | null;
  onRestocked: () => Promise<void> | void;
  isSubmitting: boolean;
}

export default function RestockDrugModal({
  isOpen,
  onClose,
  drug,
  onRestocked,
  isSubmitting,
}: RestockDrugModalProps) {
  const [quantityChange, setQuantityChange] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !drug) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (quantityChange === 0) {
      setError("Vui lòng nhập số lượng thay đổi");
      return;
    }

    try {
      const { adjustDrugStockApi } = await import("../../../../services/clinicalApi");
      await adjustDrugStockApi(drug.id, { quantityChange });
      toast.success("Đã điều chỉnh tồn kho thành công.");
      setQuantityChange(0);
      await onRestocked();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể điều chỉnh tồn kho");
    }
  };

  const newStock = drug.stockQuantity + quantityChange;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <PackagePlus size={16} className="text-emerald-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Nhập kho / Điều chỉnh tồn kho</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            disabled={isSubmitting}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
            <div>
              <p className="text-[11px] text-slate-500">Thuốc</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{drug.name}</p>
              <p className="text-[11px] text-slate-500">
                {drug.code} • {drug.concentration}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <p className="text-[11px] text-slate-500">Tồn kho hiện tại</p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">
                  {drug.stockQuantity.toLocaleString("vi-VN")}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Tồn kho sau điều chỉnh</p>
                <p
                  className={`mt-0.5 text-sm font-bold ${
                    newStock < 0 ? "text-red-600" : newStock < 500 ? "text-amber-600" : "text-emerald-700"
                  }`}
                >
                  {newStock.toLocaleString("vi-VN")}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Số lượng thay đổi <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="1"
              value={quantityChange}
              onChange={(e) => setQuantityChange(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs transition-colors focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-500/20"
              placeholder="+500 hoặc -50"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Nhập số dương để nhập kho (ví dụ +500), số âm để điều chỉnh xuất kho (ví dụ -50)
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang xử lý..." : "Xác nhận"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
