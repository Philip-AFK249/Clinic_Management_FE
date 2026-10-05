import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  IdCard,
  Info,
  Save,
  ScanLine,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import PatientNavbar from "./components/PatientNavbar";
import PatientFooter from "./components/PatientFooter";
import BhyTOcrUpload from "./components/BhyTOcrUpload";
import { useAuth } from "../../context/useAuth";
import type { Gender } from "../../types/auth";
import type { BhyTelemetry } from "./data/patientMockRecords";
import {
  BHYT_INITIAL_HOSPITALS,
  digitsOnly,
  GENDER_OPTIONS,
  hospitalCodeFrom,
  INSURANCE_CODE_LENGTH,
  NATIONAL_ID_LENGTH,
  sanitizeInsuranceCode,
  toNameCase,
} from "./data/patientProfile";

type FormErrors = Partial<
  Record<"fullName" | "phone" | "insuranceCode" | "nationalId", string>
>;

interface FormState {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender | "";
  address: string;
  nationalId: string;
  insuranceCode: string;
  initialHospitalCode: string;
}

export default function PatientProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [ocrOpen, setOcrOpen] = useState(false);

  const [form, setForm] = useState<FormState>({
    fullName: user?.fullName ?? "",
    phone: user?.phone ?? "",
    dateOfBirth: user?.dateOfBirth ?? "",
    gender: user?.gender ?? "",
    address: user?.address ?? "",
    nationalId: user?.nationalId ?? "",
    insuranceCode: user?.insuranceCode ?? "",
    initialHospitalCode: user?.initialHospitalCode ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as keyof FormErrors]) return prev;
      const next = { ...prev };
      delete next[key as keyof FormErrors];
      return next;
    });
  }

  function validate(): boolean {
    const next: FormErrors = {};

    if (!form.fullName.trim()) {
      next.fullName = "Vui lòng nhập họ và tên.";
    }

    const phone = digitsOnly(form.phone);
    if (!phone) {
      next.phone = "Vui lòng nhập số điện thoại liên hệ.";
    } else if (phone.length < 9 || phone.length > 11) {
      next.phone = "Số điện thoại phải có 9 - 11 chữ số.";
    }

    const insurance = form.insuranceCode.replace(/\s/g, "");
    if (form.insuranceCode.trim()) {
      if (!/^[A-Z0-9]+$/.test(insurance)) {
        next.insuranceCode = "Mã số thẻ BHYT chỉ gồm chữ in hoa và số.";
      } else if (insurance.length !== INSURANCE_CODE_LENGTH) {
        next.insuranceCode = `Mã số thẻ BHYT phải có đúng ${INSURANCE_CODE_LENGTH} ký tự.`;
      }
    }

    const nationalId = digitsOnly(form.nationalId);
    if (form.nationalId.trim() && nationalId.length !== NATIONAL_ID_LENGTH) {
      next.nationalId = `Số CCCD / mã định danh phải có đúng ${NATIONAL_ID_LENGTH} số.`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) {
      toast.error("Vui lòng kiểm tra lại các trường còn thiếu hoặc chưa đúng định dạng.");
      return;
    }

    updateUser({
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      dateOfBirth: form.dateOfBirth || undefined,
      gender: form.gender || undefined,
      address: form.address.trim() || undefined,
      nationalId: digitsOnly(form.nationalId) || undefined,
      insuranceCode: form.insuranceCode.trim() || undefined,
      initialHospitalCode: form.initialHospitalCode || undefined,
      // Editing the number invalidates a previous scan of the old card.
      insuranceVerified: form.insuranceCode.trim()
        ? user?.insuranceVerified && user?.insuranceCode === form.insuranceCode.trim()
        : false,
    });

    toast.success("Cập nhật thông tin hồ sơ và thẻ BHYT thành công!");
  }

  function handleOcrExtracted(info: BhyTelemetry) {
    setForm((prev) => ({
      ...prev,
      fullName: info.fullName ? toNameCase(info.fullName) : prev.fullName,
      // A BHYT card carries no phone number, so a scan never touches it.
      dateOfBirth: info.dateOfBirth || prev.dateOfBirth,
      insuranceCode: sanitizeInsuranceCode(info.insuranceCode),
      // `initialHospitalCode` is the `noi_kcb_ban_dau_full` string
      // (`79-014 (BV Đa Khoa Sài Gòn)`); the picker stores just the code.
      initialHospitalCode: hospitalCodeFrom(info.initialHospitalCode),
    }));
    setOcrOpen(false);
  }

  const insuranceNumber = form.insuranceCode.replace(/\s/g, "");
  const insuranceFilled = insuranceNumber.length > 0;
  const verified = user?.insuranceVerified === true && insuranceFilled;
  const verifiedMatches = user?.insuranceCode === form.insuranceCode.trim();
  const selectedHospital = BHYT_INITIAL_HOSPITALS.find(
    (option) => option.code === form.initialHospitalCode,
  );

  return (
    <div className="min-h-screen bg-surface-light text-slate-900">
      <PatientNavbar />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-clinical-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Quay lại
        </button>

        <div className="mt-4 flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-clinical-600">
            Cổng Bệnh nhân
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Hồ sơ Bệnh nhân &amp; Thông tin BHYT
          </h1>
          <p className="text-base text-slate-500">
            Quản lý thông tin định danh, số điện thoại liên hệ và quyền lợi thẻ
            Bảo hiểm Y tế
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
          {/* Personal information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-clinical-50 text-clinical-600">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Thông tin cá nhân
              </h2>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field
                label="Họ và tên"
                htmlFor="fullName"
                error={errors.fullName}
                value={form.fullName}
                onChange={(value) => set("fullName", value)}
              />
              <Field
                label="Số điện thoại"
                htmlFor="phone"
                type="tel"
                error={errors.phone}
                value={form.phone}
                onChange={(value) => set("phone", value)}
              />
              <Field
                label="Địa chỉ Email"
                htmlFor="email"
                type="email"
                value={user?.email ?? ""}
                readOnly
                hint="Email là định danh đăng nhập, liên hệ bộ phận CSKH để thay đổi."
              />
              <Field
                label="Ngày sinh"
                htmlFor="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={(value) => set("dateOfBirth", value)}
              />

              <div>
                <label
                  htmlFor="gender"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Giới tính
                </label>
                <select
                  id="gender"
                  value={form.gender}
                  onChange={(event) =>
                    set("gender", event.target.value as Gender | "")
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-100"
                >
                  <option value="">-- Chọn giới tính --</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <Field
                label="Địa chỉ thường trú"
                htmlFor="address"
                value={form.address}
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                onChange={(value) => set("address", value)}
              />
            </div>
          </section>

          {/* BHYT & CCCD */}
          <section className="overflow-hidden rounded-2xl border border-clinical-200 bg-white shadow-card">
            <div className="flex items-center gap-2 border-b border-clinical-100 bg-gradient-to-r from-clinical-50 to-emerald-50 px-6 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-clinical-600 shadow-sm">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Thẻ Bảo hiểm Y tế &amp; CCCD
                </h2>
                <p className="text-xs text-slate-500">
                  Dùng để thanh toán tại quầy và đối soát quyền lợi đúng tuyến
                </p>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <Field
                label="Mã số thẻ BHYT (15 ký tự chuẩn)"
                htmlFor="insuranceCode"
                error={errors.insuranceCode}
                value={form.insuranceCode}
                placeholder="VD: DN 4 79 79 12345678"
                mono
                onChange={(value) => set("insuranceCode", sanitizeInsuranceCode(value))}
                hint={
                  insuranceFilled
                    ? `${insuranceNumber.length}/${INSURANCE_CODE_LENGTH} ký tự`
                    : "Để trống nếu bạn không sử dụng BHYT"
                }
              />

              <div>
                <label
                  htmlFor="initialHospitalCode"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Nơi Đăng Ký Khám Chữa Bệnh Ban Đầu
                </label>
                <select
                  id="initialHospitalCode"
                  value={form.initialHospitalCode}
                  onChange={(event) =>
                    set("initialHospitalCode", event.target.value)
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-100"
                >
                  <option value="">-- Chọn cơ sở khám chữa bệnh ban đầu --</option>
                  {BHYT_INITIAL_HOSPITALS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {selectedHospital && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    {selectedHospital.label.includes("Trái tuyến")
                      ? "Thẻ đang đăng ký tại cơ sở trái tuyến: BHYT hỗ trợ 40% chi phí khám chữa bệnh."
                      : "Thẻ đang đăng ký đúng tuyến: BHYT chi trả 80% chi phí khám chữa bệnh trong phạm vi đã quy định."}
                  </p>
                )}
              </div>

              <Field
                label="Số CCCD / Mã định danh (12 số)"
                htmlFor="nationalId"
                inputMode="numeric"
                error={errors.nationalId}
                value={form.nationalId}
                placeholder="079xxxxxxxx"
                onChange={(value) => set("nationalId", digitsOnly(value))}
              />

              {/* OCR status */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2.5">
                    {verified && verifiedMatches ? (
                      <CheckCircle2
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                    ) : (
                      <AlertCircle
                        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Trạng thái Xác thực BHYT (OCR Status)
                      </p>
                      {verified && verifiedMatches ? (
                        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                          ✓ Thẻ BHYT đã được xác thực OCR hợp lệ
                        </p>
                      ) : (
                        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                          Chưa xác thực OCR qua ảnh thẻ
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOcrOpen(true)}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-clinical-200 bg-white px-4 text-sm font-semibold text-clinical-700 shadow-sm transition-colors hover:bg-clinical-50"
                  >
                    <ScanLine className="h-4 w-4" aria-hidden="true" />
                    Quét thẻ BHYT
                  </button>
                </div>

                {verified && !verifiedMatches && (
                  <p className="mt-3 flex items-start gap-2 text-xs text-amber-700">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Mã thẻ đã thay đổi so với lần quét gần nhất. Hãy quét lại ảnh
                    thẻ để xác thực, hoặc lưu để tiếp tục dùng thẻ chưa xác thực.
                  </p>
                )}
              </div>

              {/* Benefit explainer */}
              <div className="flex items-start gap-3 rounded-xl border border-clinical-200 bg-clinical-50/70 p-4">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-clinical-600"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-clinical-900">
                    Quyền lợi BHYT giải thích
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-clinical-800">
                    <strong>Đúng tuyến:</strong> BHYT chi trả 80% - 100% chi phí
                    KCB theo danh mục Bộ Y tế | <strong>Trái tuyến:</strong> BHYT
                    hỗ trợ 40% chi phí
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setOcrOpen(true)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <IdCard className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Quét lại thẻ BHYT
            </button>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-clinical-600 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-clinical-700"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Lưu Thông Tin Hồ Sơ &amp; BHYT
            </button>
          </div>
        </form>
      </main>

      <PatientFooter />

      {/* OCR modal */}
      {ocrOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quét thẻ BHYT bằng OCR"
        >
          <button
            type="button"
            aria-label="Đóng cửa sổ quét thẻ BHYT"
            onClick={() => setOcrOpen(false)}
            className="fixed inset-0 bg-slate-900/40"
          />

          <div className="relative mx-auto mt-10 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-elevated">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Quét thẻ BHYT bằng OCR
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Thông tin nhận dạng sẽ được điền tự động vào biểu mẫu hồ sơ.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOcrOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Đóng</span>
              </button>
            </div>

            <BhyTOcrUpload onExtracted={handleOcrExtracted} />
          </div>
        </div>
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  readOnly?: boolean;
  inputMode?: "numeric" | "text";
  mono?: boolean;
}

function Field({
  label,
  htmlFor,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  hint,
  readOnly = false,
  inputMode,
  mono = false,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={htmlFor}
        type={type}
        value={value}
        readOnly={readOnly}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${htmlFor}-error` : undefined}
        onChange={(event) => onChange?.(event.target.value)}
        className={`h-11 w-full rounded-lg border px-3 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 ${
          error
            ? "border-red-300 bg-red-50/40 focus:border-red-400 focus:ring-red-100"
            : "border-slate-200 bg-white focus:border-clinical-500 focus:ring-clinical-100"
        } ${
          readOnly ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""
        } ${mono ? "font-mono font-semibold tracking-wider uppercase" : ""}`}
      />
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}