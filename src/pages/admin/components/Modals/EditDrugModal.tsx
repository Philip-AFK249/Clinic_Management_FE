import { useState, type FormEvent } from "react";
import { X, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { BhytCoverageType, DrugDto, UpdateDrugPayload } from "../../../../services/clinicalApi";
import { updateDrugApi } from "../../../../services/clinicalApi";

interface EditDrugModalProps {
  drug: DrugDto | null;
  onClose: () => void;
  onUpdated: (drug: DrugDto) => void | Promise<void>;
  isOpen?: boolean;
  isSubmitting?: boolean;
}

interface EditDrugFormProps {
  drug: DrugDto;
  onClose: () => void;
  onUpdated: (drug: DrugDto) => void | Promise<void>;
  isSubmitting: boolean;
}

const BHYT_OPTIONS: Array<{ value: BhytCoverageType; label: string }> = [
  { value: "BHYT_80", label: "BHYT 80%" },
  { value: "BHYT_100", label: "BHYT 100%" },
  { value: "SELF_PAY", label: "Tự túc" },
];

const DOSAGE_FORMS = [
  "Viên nén",
  "Viên nang",
  "Siro",
  "Dung dịch",
  "Bột",
  "Nhũ tương",
  "Bình xịt",
  "Ống tiêm",
  "Kem",
  "Mỡ",
];

function toFormData(drug: DrugDto): UpdateDrugPayload {
  return {
    name: drug.name,
    concentration: drug.concentration,
    dosageForm: drug.dosageForm,
    unitPrice: drug.unitPrice,
    stockQuantity: drug.stockQuantity,
    bhytCoverage: drug.bhytCoverage,
    isPenicillinClass: drug.isPenicillinClass,
    active: drug.active,
  };
}

export default function EditDrugModal({
  isOpen = true,
  onClose,
  drug,
  onUpdated,
  isSubmitting = false,
}: EditDrugModalProps) {
  if (!isOpen || !drug) return null;

  return (
    <EditDrugForm
      key={drug.id}
      drug={drug}
      onClose={onClose}
      onUpdated={onUpdated}
      isSubmitting={isSubmitting}
    />
  );
}

function EditDrugForm({
  drug,
  onClose,
  onUpdated,
  isSubmitting: isSubmittingProp,
}: EditDrugFormProps) {
  const [formData, setFormData] = useState<UpdateDrugPayload>(() => toFormData(drug));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const submitting = isSubmittingProp || isLoading;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Vui lòng nhập tên thuốc");
      return;
    }
    if (!formData.concentration.trim()) {
      setError("Vui lòng nhập hàm lượng");
      return;
    }
    if (!formData.dosageForm.trim()) {
      setError("Vui lòng nhập dạng bào chế");
      return;
    }
    if (formData.unitPrice <= 0) {
      setError("Đơn giá phải lớn hơn 0");
      return;
    }
    if (formData.stockQuantity < 0) {
      setError("Tồn kho không thể âm");
      return;
    }

    setIsLoading(true);
    try {
      const data = await updateDrugApi(drug.id, {
        ...formData,
        name: formData.name.trim(),
        concentration: formData.concentration.trim(),
        dosageForm: formData.dosageForm.trim(),
      });
      toast.success("Đã cập nhật thông tin thuốc.");
      await onUpdated(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật thuốc");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-xs transition-colors focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-500/20 disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <Edit size={16} className="text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Chỉnh sửa Thuốc</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            disabled={submitting}
            aria-label="Đóng"
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

          <div>
            <label htmlFor="edit-drug-code" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Mã thuốc
            </label>
            <input
              id="edit-drug-code"
              type="text"
              value={drug.code}
              readOnly
              className={`${inputClass} cursor-not-allowed bg-slate-50 font-mono text-slate-600`}
            />
            <p className="mt-1 text-[11px] text-slate-500">Mã thuốc không thể chỉnh sửa.</p>
          </div>

          <div>
            <label htmlFor="edit-drug-name" className="mb-1.5 block text-xs font-semibold text-slate-700">
              Tên thuốc <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-drug-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className={inputClass}
              placeholder="Augmentin"
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-drug-concentration"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                Hàm lượng <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-drug-concentration"
                type="text"
                value={formData.concentration}
                onChange={(e) => setFormData((prev) => ({ ...prev, concentration: e.target.value }))}
                className={inputClass}
                placeholder="625mg"
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="edit-drug-dosage-form"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                Dạng bào chế <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-drug-dosage-form"
                type="text"
                list="dosage-forms-edit"
                value={formData.dosageForm}
                onChange={(e) => setFormData((prev) => ({ ...prev, dosageForm: e.target.value }))}
                className={inputClass}
                placeholder="Viên nén"
                disabled={submitting}
              />
              <datalist id="dosage-forms-edit">
                {DOSAGE_FORMS.map((form) => (
                  <option key={form} value={form} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-drug-unit-price"
                className="mb-1.5 block text-xs font-semibold text-slate-700"
              >
                Đơn giá (VNĐ) <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-drug-unit-price"
                type="number"
                min="1"
                step="100"
                value={formData.unitPrice}
                onChange={(e) => setFormData((prev) => ({ ...prev, unitPrice: Number(e.target.value) || 0 }))}
                className={inputClass}
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="edit-drug-stock" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Tồn kho <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-drug-stock"
                type="number"
                min="0"
                step="1"
                value={formData.stockQuantity}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, stockQuantity: Number(e.target.value) || 0 }))
                }
                className={inputClass}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-drug-bhyt" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Hình thức bảo hiểm
              </label>
              <select
                id="edit-drug-bhyt"
                value={formData.bhytCoverage}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, bhytCoverage: e.target.value as BhytCoverageType }))
                }
                className={inputClass}
                disabled={submitting}
              >
                {BHYT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.isPenicillinClass ?? false}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isPenicillinClass: e.target.checked }))
                  }
                  className="h-3.5 w-3.5 rounded border-slate-300 text-clinical-600 focus:ring-clinical-500"
                  disabled={submitting}
                />
                Nhóm penicillin (cảnh báo dị ứng)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-slate-700">Trạng thái hoạt động</p>
              <p className="text-[11px] text-slate-500">
                {formData.active ? "Đang được phép kê đơn" : "Đã ngừng sử dụng"}
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={formData.active ?? true}
                onChange={(e) => setFormData((prev) => ({ ...prev, active: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-slate-300 text-clinical-600 focus:ring-clinical-500"
                disabled={submitting}
              />
              {formData.active ? "Đang hoạt động" : "Ngừng hoạt động"}
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-clinical-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-clinical-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {submitting ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}