import { useState } from "react";
import {
  AlertCircle,
  CreditCard,
  Loader2,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { updatePatientByAdminApi } from "../../../../services/authApi";
import type {
  AuthResponseDto,
  UpdatePatientRequestDto,
} from "../../../../services/authApi";
import BhyCardPreview from "../../../patient/components/BhyCardPreview";
import type { Gender } from "../../../../types/auth";
import {
  BHYT_INITIAL_HOSPITALS,
  digitsOnly,
  dobLabelFrom,
  GENDER_OPTIONS,
  genderFrom,
  hospitalLabelFrom,
  INSURANCE_CODE_LENGTH,
  NATIONAL_ID_LENGTH,
  sanitizeInsuranceCode,
} from "../../../patient/data/patientProfile";

interface EditPatientModalProps {
  patient: AuthResponseDto;
  token: string | undefined;
  onClose: () => void;
  onSaved: (patient: AuthResponseDto) => void;
}

type FormErrors = Partial<
  Record<"fullName" | "insuranceCode" | "identityCardNumber", string>
>;

const FIELD_CLASS =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-100";

/** Blank optional text becomes `null`, which is what clears a nullable column. */
function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Admin mirror of the Patient Portal profile screen: the same three-section
 * layout (personal details, live green BHYT card, editable identity & BHYT
 * fields) driving one PUT to `UpdatePatientRequest`. The card is fed from the
 * form state so it can never disagree with what is about to be submitted.
 */
export default function EditPatientModal({
  patient,
  token,
  onClose,
  onSaved,
}: EditPatientModalProps) {
  const [fullName, setFullName] = useState(patient.fullName ?? "");
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(patient.dateOfBirth ?? "");
  const [gender, setGender] = useState<Gender | "">(
    patient.gender ? genderFrom(patient.gender) : "",
  );
  const [address, setAddress] = useState(patient.address ?? "");
  const [identityCardNumber, setIdentityCardNumber] = useState(
    patient.identityCardNumber ?? "",
  );
  const [insuranceCode, setInsuranceCode] = useState(patient.insuranceCode ?? "");
  const [initialHospitalCode, setInitialHospitalCode] = useState(
    patient.initialHospitalCode ?? "",
  );
  const [isOcrVerified, setIsOcrVerified] = useState(patient.isOcrVerified === true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const insuranceDigits = insuranceCode.replace(/\s/g, "");
  const insuranceFilled = insuranceDigits.length > 0;

  function clearError(key: keyof FormErrors) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!fullName.trim()) {
      next.fullName = "Vui lòng nhập họ và tên.";
    }
    if (insuranceFilled) {
      if (!/^[A-Z0-9]+$/.test(insuranceDigits)) {
        next.insuranceCode = "Mã số thẻ BHYT chỉ gồm chữ in hoa và số.";
      } else if (insuranceDigits.length !== INSURANCE_CODE_LENGTH) {
        next.insuranceCode = `Mã số thẻ BHYT phải có đúng ${INSURANCE_CODE_LENGTH} ký tự.`;
      }
    }
    if (
      identityCardNumber.trim() &&
      identityCardNumber.length !== NATIONAL_ID_LENGTH
    ) {
      next.identityCardNumber = `Số CCCD / mã định danh phải có đúng ${NATIONAL_ID_LENGTH} số.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!token) {
      toast.error("Phiên quản trị viên không hợp lệ. Vui lòng đăng nhập lại.");
      return;
    }
    if (!validate()) {
      toast.error("Vui lòng kiểm tra lại các trường còn thiếu hoặc chưa đúng định dạng.");
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
      toast.success(`Đã cập nhật hồ sơ & BHYT của ${updated.fullName}.`);
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

  const selectedHospital = BHYT_INITIAL_HOSPITALS.find(
    (option) => option.code === initialHospitalCode,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Hồ sơ chi tiết & BHYT của ${patient.fullName}`}
    >
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40"
      />

      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200/80 bg-white shadow-elevated">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              Hồ Sơ Chi Tiết &amp; Thẻ BHYT
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

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-4">
          {/* Section 1: personal information */}
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-clinical-50 text-clinical-600">
                <UserRound size={16} aria-hidden="true" />
              </span>
              <h4 className="text-sm font-bold text-slate-900">
                Thông tin cá nhân
              </h4>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="admin-fullName"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Họ và tên *
                </label>
                <input
                  id="admin-fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    clearError("fullName");
                  }}
                  aria-invalid={errors.fullName ? true : undefined}
                  className={`${FIELD_CLASS} ${
                    errors.fullName ? "border-red-300 bg-red-50/40" : ""
                  }`}
                />
                {errors.fullName && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-600">
                    <AlertCircle size={12} className="shrink-0" aria-hidden="true" />
                    {errors.fullName}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="admin-phone"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
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
                  htmlFor="admin-email"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Địa chỉ Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={patient.email ?? ""}
                  readOnly
                  className={`${FIELD_CLASS} cursor-not-allowed bg-slate-50 text-slate-500`}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Email là định danh đăng nhập, không thể thay đổi tại đây.
                </p>
              </div>
              <div>
                <label
                  htmlFor="admin-dob"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
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
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  Giới tính
                </label>
                <select
                  id="admin-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender | "")}
                  className={FIELD_CLASS}
                >
                  <option value="">-- Chọn giới tính --</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="admin-address"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
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
            </div>
          </section>

          {/* Section 2 + 3: live card preview over the editable BHYT fields */}
          <section className="overflow-hidden rounded-xl border border-clinical-200 bg-white">
            <div className="flex items-center gap-2 border-b border-clinical-100 bg-gradient-to-r from-clinical-50 to-emerald-50 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-clinical-600 shadow-sm">
                <CreditCard size={16} aria-hidden="true" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Thẻ Bảo hiểm Y tế &amp; CCCD
                </h4>
                <p className="text-[11px] text-slate-500">
                  Xem trước thẻ cập nhật trực tiếp khi chỉnh sửa các trường bên dưới
                </p>
              </div>
              <span className="ml-auto">
                {isOcrVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <ShieldCheck size={11} aria-hidden="true" />
                    Đã xác thực OCR
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    Chưa xác thực
                  </span>
                )}
              </span>
            </div>

            <div className="space-y-4 p-4">
              <BhyCardPreview
                fullName={fullName}
                insuranceCode={insuranceCode.trim()}
                dateOfBirthLabel={dobLabelFrom(dateOfBirth)}
                gender={GENDER_OPTIONS.find((o) => o.value === gender)?.label ?? ""}
                hospital={hospitalLabelFrom(initialHospitalCode)}
                address={address}
                verified={isOcrVerified}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="admin-cccd"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Số CCCD / Mã định danh (12 số)
                  </label>
                  <input
                    id="admin-cccd"
                    type="text"
                    inputMode="numeric"
                    value={identityCardNumber}
                    onChange={(e) => {
                      setIdentityCardNumber(digitsOnly(e.target.value));
                      clearError("identityCardNumber");
                    }}
                    placeholder="079xxxxxxxx"
                    aria-invalid={errors.identityCardNumber ? true : undefined}
                    className={`${FIELD_CLASS} font-mono ${
                      errors.identityCardNumber ? "border-red-300 bg-red-50/40" : ""
                    }`}
                  />
                  {errors.identityCardNumber ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-600">
                      <AlertCircle size={12} className="shrink-0" aria-hidden="true" />
                      {errors.identityCardNumber}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {identityCardNumber.length}/{NATIONAL_ID_LENGTH} chữ số
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="admin-insurance"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Mã số thẻ BHYT (15 ký tự chuẩn)
                  </label>
                  <input
                    id="admin-insurance"
                    type="text"
                    value={insuranceCode}
                    onChange={(e) => {
                      setInsuranceCode(sanitizeInsuranceCode(e.target.value));
                      clearError("insuranceCode");
                    }}
                    placeholder="VD: DN 4 79 79 12345678"
                    aria-invalid={errors.insuranceCode ? true : undefined}
                    className={`${FIELD_CLASS} font-mono font-semibold uppercase tracking-wider ${
                      errors.insuranceCode ? "border-red-300 bg-red-50/40" : ""
                    }`}
                  />
                  {errors.insuranceCode ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-600">
                      <AlertCircle size={12} className="shrink-0" aria-hidden="true" />
                      {errors.insuranceCode}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {insuranceFilled
                        ? `${insuranceDigits.length}/${INSURANCE_CODE_LENGTH} ký tự`
                        : "Để trống nếu bệnh nhân không sử dụng BHYT"}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="admin-hospital"
                    className="mb-1.5 block text-xs font-semibold text-slate-700"
                  >
                    Nơi Đăng Ký Khám Chữa Bệnh Ban Đầu
                  </label>
                  <select
                    id="admin-hospital"
                    value={initialHospitalCode}
                    onChange={(e) => setInitialHospitalCode(e.target.value)}
                    className={FIELD_CLASS}
                  >
                    <option value="">
                      -- Chọn cơ sở khám chữa bệnh ban đầu --
                    </option>
                    {BHYT_INITIAL_HOSPITALS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 flex items-start gap-1.5 text-[11px] text-slate-500">
                    <ShieldCheck
                      size={12}
                      className="mt-0.5 shrink-0 text-clinical-500"
                      aria-hidden="true"
                    />
                    <span>
                      {selectedHospital
                        ? selectedHospital.label.includes("Trái tuyến")
                          ? "Thẻ đang đăng ký tại cơ sở trái tuyến: BHYT hỗ trợ 40% chi phí khám chữa bệnh."
                          : "Thẻ đang đăng ký đúng tuyến: BHYT chi trả 80% chi phí khám chữa bệnh trong phạm vi đã quy định."
                        : "Đúng tuyến BHYT chi trả 80% - 100% chi phí, trái tuyến hỗ trợ 40%."}
                    </span>
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
            </div>
          </section>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              aria-busy={isSaving}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-clinical-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-clinical-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Save size={14} aria-hidden="true" />
              )}
              {isSaving ? "Đang lưu..." : "Lưu Thông Tin Hồ Sơ & BHYT"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
