import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updatePatientByAdminApi } from "../../../../services/authApi";
import type { AuthResponseDto, UpdatePatientRequestDto } from "../../../../services/authApi";
import {
  BHYT_INITIAL_HOSPITALS,
  digitsOnly,
  sanitizeInsuranceCode,
} from "../../../patient/data/patientProfile";

interface EditPatientModalProps {
  patient: AuthResponseDto;
  token: string | undefined;
  onClose: () => void;
  onSaved: (patient: AuthResponseDto) => void;
}

const GENDER_OPTIONS = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "OTHER", label: "Khác" },
] as const;

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300";

/** Blank optional text becomes `null`, which is what clears a nullable column. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default function EditPatientModal({
  patient,
  token,
  onClose,
  onSaved,
}: EditPatientModalProps) {
  const [fullName, setFullName] = useState(patient.fullName ?? "");
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [identityCardNumber, setIdentityCardNumber] = useState(
    patient.identityCardNumber ?? "",
  );
  const [insuranceCode, setInsuranceCode] = useState(patient.insuranceCode ?? "");
  const [initialHospitalCode, setInitialHospitalCode] = useState(
    patient.initialHospitalCode ?? "",
  );
  const [dateOfBirth, setDateOfBirth] = useState(patient.dateOfBirth ?? "");
  const [gender, setGender] = useState(patient.gender ?? "");
  const [address, setAddress] = useState(patient.address ?? "");
  const [isOcrVerified, setIsOcrVerified] = useState(patient.isOcrVerified === true);
  const [isSaving, setIsSaving] = useState(false);

  const insuranceDigits = insuranceCode.replace(/\s/g, "");
  const insuranceLengthOk = insuranceDigits.length === 15;
  const cccdOk = identityCardNumber === "" || identityCardNumber.length === 12;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!token) {
      toast.error("Phiên quản trị viên không hợp lệ. Vui lòng đăng nhập lại.");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Họ và tên không được để trống.");
      return;
    }
    if (insuranceDigits.length > 0 && !insuranceLengthOk) {
      toast.error("Mã số thẻ BHYT phải có đúng 15 ký tự.");
      return;
    }
    if (!cccdOk) {
      toast.error("Số CCCD phải có đúng 12 chữ số.");
      return;
    }

    const payload: UpdatePatientRequestDto = {
      fullName: fullName.trim(),
      phone: optional(phone),
      identityCardNumber: optional(identityCardNumber),
      insuranceCode: optional(insuranceDigits),
      initialHospitalCode: optional(initialHospitalCode),
      dateOfBirth: dateOfBirth || null,
      gender: optional(gender),
      address: optional(address),
      isOcrVerified,
    };

    setIsSaving(true);
    try {
      const updated = await updatePatientByAdminApi(patient.userId, payload, token);
      onSaved(updated);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Không thể cập nhật hồ sơ bệnh nhân.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Sửa hồ sơ bệnh nhân ${patient.fullName}`}
    >
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40"
      />

      <div className="relative w-full max-w-2xl rounded-xl border border-slate-200/80 bg-white shadow-elevated">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              Sửa Hồ Sơ &amp; Thẻ BHYT
            </h3>
            <p className="truncate text-[11px] text-slate-500">
              {patient.fullName} · {patient.email} · users.id = {patient.userId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="admin-fullName"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Họ và tên *
              </label>
              <input
                id="admin-fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label
                htmlFor="admin-phone"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Số điện thoại
              </label>
              <input
                id="admin-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xx xxx xxx"
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label
                htmlFor="admin-dob"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Ngày sinh
              </label>
              <input
                id="admin-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label
                htmlFor="admin-gender"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Giới tính
              </label>
              <select
                id="admin-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">-- Chưa cập nhật --</option>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-address"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Địa chỉ thường trú
            </label>
            <input
              id="admin-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
              className={FIELD_CLASS}
            />
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="mb-3 text-xs font-bold text-emerald-900">
              Định danh &amp; Bảo hiểm Y tế
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="admin-cccd"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Số CCCD / Mã định danh
                </label>
                <input
                  id="admin-cccd"
                  type="text"
                  inputMode="numeric"
                  value={identityCardNumber}
                  onChange={(e) => setIdentityCardNumber(digitsOnly(e.target.value))}
                  placeholder="079012345678"
                  className={`${FIELD_CLASS} font-mono ${
                    cccdOk ? "" : "border-red-300 text-red-600"
                  }`}
                />
                <p
                  className={`mt-1 text-[11px] ${
                    cccdOk ? "text-slate-400" : "font-medium text-red-600"
                  }`}
                >
                  {cccdOk
                    ? "12 chữ số"
                    : `${identityCardNumber.length}/12 - phải đủ 12 chữ số`}
                </p>
              </div>
              <div>
                <label
                  htmlFor="admin-insurance"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Mã số thẻ BHYT
                </label>
                <input
                  id="admin-insurance"
                  type="text"
                  value={insuranceCode}
                  onChange={(e) =>
                    setInsuranceCode(sanitizeInsuranceCode(e.target.value))
                  }
                  placeholder="DN 4 79 79 12345678"
                  className={`${FIELD_CLASS} font-mono uppercase tracking-wider ${
                    insuranceLengthOk || insuranceDigits.length === 0
                      ? ""
                      : "border-red-300 text-red-600"
                  }`}
                />
                <p
                  className={`mt-1 text-[11px] ${
                    insuranceLengthOk || insuranceDigits.length === 0
                      ? "text-slate-400"
                      : "font-medium text-red-600"
                  }`}
                >
                  {insuranceDigits.length}/15 ký tự
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label
                htmlFor="admin-hospital"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Nơi Đăng Ký Khám Chữa Bệnh Ban Đầu
              </label>
              <input
                id="admin-hospital"
                type="text"
                list="admin-hospital-options"
                value={initialHospitalCode}
                onChange={(e) => setInitialHospitalCode(e.target.value)}
                placeholder="79-014 (BV Đa Khoa Sài Gòn)"
                className={FIELD_CLASS}
              />
              <datalist id="admin-hospital-options">
                {BHYT_INITIAL_HOSPITALS.map((hospital) => (
                  <option key={hospital.code} value={hospital.code}>
                    {hospital.label}
                  </option>
                ))}
              </datalist>
              <p className="mt-1 text-[11px] text-slate-400">
                Gợi ý mã cơ sở đã dùng; có thể nhập cơ sở khác.
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={isOcrVerified}
              onChange={(e) => setIsOcrVerified(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs font-semibold text-slate-700">
              Đã xác thực OCR qua ảnh thẻ
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Save size={14} aria-hidden="true" />
              )}
              {isSaving ? "Đang lưu..." : "Lưu Thay Đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
