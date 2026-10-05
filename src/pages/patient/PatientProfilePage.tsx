import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  IdCard,
  Loader2,
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
import BhyCardPreview from "./components/BhyCardPreview";
import { useAuth } from "../../context/useAuth";
import { updateMyProfileApi } from "../../services/authApi";
import type { Gender, User } from "../../types/auth";
import type { BhyTelemetry } from "./data/patientMockRecords";
import {
  BHYT_INITIAL_HOSPITALS,
  digitsOnly,
  dobLabelFrom,
  GENDER_OPTIONS,
  genderFrom,
  hospitalCodeFrom,
  hospitalLabelFrom,
  INSURANCE_CODE_LENGTH,
  meetsFiveYearRule,
  NATIONAL_ID_LENGTH,
  sanitizeInsuranceCode,
  toNameCase,
} from "./data/patientProfile";

type FormErrors = Partial<
  Record<
    "fullName" | "phone" | "insuranceCode" | "identityCardNumber",
    string
  >
>;

interface FormState {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender | "";
  address: string;
  identityCardNumber: string;
  insuranceCode: string;
  initialHospitalCode: string;
}

/**
 * The session, as the form wants it.
 *
 * `genderFrom` is the one fold needed here: the session carries the backend's
 * free-form varchar, while the `<select>` only has `<option>`s for the enum, and
 * a value it does not recognise would render as a blank control.
 */
function formFromSession(user: User | null): FormState {
  return {
    fullName: user?.fullName ?? "",
    phone: user?.phone ?? "",
    dateOfBirth: user?.dateOfBirth ?? "",
    gender: user?.gender ? genderFrom(user.gender) : "",
    address: user?.address ?? "",
    identityCardNumber: user?.identityCardNumber ?? "",
    insuranceCode: user?.insuranceCode ?? "",
    initialHospitalCode: user?.initialHospitalCode ?? "",
  };
}

/**
 * The session fields the form is seeded from, collapsed to one comparable value.
 *
 * `user` is a brand-new object after every `/me` refresh and every save, so
 * comparing identity would reseed the form on every render. Comparing the values
 * the form actually came from means it is rebuilt only when one of them really
 * moved.
 */
function sessionSignature(user: User | null): string {
  if (!user) return "";
  // JSON rather than a hand-rolled separator: an address could contain whatever
  // character someone picked as the join string, and a collision there would
  // silently skip a reseed.
  return JSON.stringify([
    user.fullName,
    user.phone,
    user.dateOfBirth,
    user.gender,
    user.address,
    user.identityCardNumber,
    user.insuranceCode,
    user.initialHospitalCode,
  ]);
}

export default function PatientProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [ocrOpen, setOcrOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>(() => formFromSession(user));
  const [errors, setErrors] = useState<FormErrors>({});
  /**
   * The validity window the last scan read off the card.
   *
   * Page state, not session state: `User` has no column for it, so there is
   * nowhere honest to persist it. It survives a scan -> save round trip on this
   * page and is gone on reload, which is why both rows below are labelled as
   * coming from the card rather than as stored profile data.
   */
  const [validity, setValidity] = useState<{
    display: string;
    meetsFiveYears: boolean;
  } | null>(null);

  /**
   * Adopt a session that changed underneath the form.
   *
   * The case that matters: `AuthProvider` revalidates on mount, and that `/me`
   * response arrives *after* the first paint - it is what first carries the
   * phone number a patient registered with and any card saved earlier. Seeding
   * only in the `useState` initializer would miss it and leave the form showing
   * the sparse pre-refresh session.
   *
   * Adjusted during render rather than in an effect, so the new values land in
   * the same commit instead of cascading a second one - and so a save, which
   * rebuilds `user` from the very values the form already holds, is a no-op
   * rather than a reset that could discard an edit.
   */
  const session = sessionSignature(user);
  const [seededFrom, setSeededFrom] = useState(session);
  if (seededFrom !== session) {
    setSeededFrom(session);
    setForm(formFromSession(user));
  }

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

    const identityCardNumber = digitsOnly(form.identityCardNumber);
    if (
      form.identityCardNumber.trim() &&
      identityCardNumber.length !== NATIONAL_ID_LENGTH
    ) {
      next.identityCardNumber = `Số CCCD / mã định danh phải có đúng ${NATIONAL_ID_LENGTH} số.`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) {
      toast.error("Vui lòng kiểm tra lại các trường còn thiếu hoặc chưa đúng định dạng.");
      return;
    }
    if (saving) return;

    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const identityCardNumber = digitsOnly(form.identityCardNumber);
    const insuranceCode = form.insuranceCode.trim();
    const initialHospitalCode = form.initialHospitalCode;
    const dateOfBirth = form.dateOfBirth;
    const gender = form.gender;
    const address = form.address.trim();

    // Editing the number invalidates a previous scan of the old card: the scan
    // verified one number, and this is a different one.
    const isOcrVerified = insuranceCode
      ? user?.isOcrVerified === true && user?.insuranceCode === insuranceCode
      : false;

    setSaving(true);
    try {
      // AuthService first. `updateUser` below only refreshes the stored session,
      // so announcing success before this resolves would claim a save the
      // backend never accepted. `null` clears a column - omitting it would not,
      // because the endpoint overwrites whatever it receives.
      await updateMyProfileApi({
        fullName,
        phone: phone || null,
        identityCardNumber: identityCardNumber || null,
        insuranceCode: insuranceCode || null,
        initialHospitalCode: initialHospitalCode || null,
        dateOfBirth: dateOfBirth || null,
        gender: gender || null,
        address: address || null,
        isOcrVerified,
      });
    } catch (error) {
      toast.error("Không lưu được hồ sơ lên hệ thống.", {
        description: error instanceof Error ? error.message : undefined,
      });
      return;
    } finally {
      setSaving(false);
    }

    // Same values into the local session, so the rest of the portal (navbar,
    // booking form, dashboard) reads what was just saved without a reload - and
    // so a reload does not need the `/me` round trip to show them.
    updateUser({
      fullName,
      phone,
      dateOfBirth: dateOfBirth || undefined,
      gender: gender || undefined,
      address: address || undefined,
      identityCardNumber: identityCardNumber || undefined,
      insuranceCode: insuranceCode || undefined,
      initialHospitalCode: initialHospitalCode || undefined,
      isOcrVerified,
    });

    toast.success("Cập nhật thông tin hồ sơ và thẻ BHYT thành công!");
  }

  /**
   * Bind a scanned card into the profile form.
   *
   * Every field falls back to what is already there, so a card that reads only
   * half of its data cannot blank out what the patient typed or what AuthService
   * already holds. `phone` is never touched at all: a BHYT card carries none, and
   * the demo preset's `0900 000 000` must not overwrite a real number.
   */
  function handleOcrExtracted(info: BhyTelemetry) {
    setForm((prev) => ({
      ...prev,
      fullName: info.fullName ? toNameCase(info.fullName) : prev.fullName,
      dateOfBirth: info.dateOfBirth || prev.dateOfBirth,
      gender: info.gender?.trim() ? genderFrom(info.gender) : prev.gender,
      address: info.address?.trim() || prev.address,
      insuranceCode: sanitizeInsuranceCode(info.insuranceCode) || prev.insuranceCode,
      // `initialHospitalCode` is the `noi_kcb_ban_dau_full` string
      // (`79-014 (BV Đa Khoa Sài Gòn)`); the picker stores just the code.
      initialHospitalCode:
        hospitalCodeFrom(info.initialHospitalCode) || hospitalCodeFrom(info.hospital ?? "") || prev.initialHospitalCode,
    }));
    // Only the latest scan's window is meaningful: it describes the card that is
    // on the form right now, so a re-scan replaces it rather than adding to it.
    setValidity({
      display: info.validityDisplay?.trim() ?? "",
      meetsFiveYears: meetsFiveYearRule(info.validFrom, info.validUntil),
    });
    setOcrOpen(false);
  }

  const insuranceNumber = form.insuranceCode.replace(/\s/g, "");
  const insuranceFilled = insuranceNumber.length > 0;
  const trimmedInsurance = form.insuranceCode.trim();
  /** True only while the stored scan still describes the number in the field. */
  const verified =
    user?.isOcrVerified === true &&
    insuranceFilled &&
    user?.insuranceCode === trimmedInsurance;
  /**
   * The card was verified once and the number has since been edited, so what is
   * on screen is no longer the card that was read. Surfaced on the number itself
   * rather than in a panel, because it is that field that is now unverified.
   */
  const insuranceEdited =
    user?.isOcrVerified === true && insuranceFilled && !verified;

  const selectedHospital = BHYT_INITIAL_HOSPITALS.find(
    (option) => option.code === form.initialHospitalCode,
  );

  const insuranceHint = [
    insuranceFilled ? `${insuranceNumber.length}/${INSURANCE_CODE_LENGTH} ký tự` : null,
    insuranceEdited ? "đã đổi so với lần quét gần nhất - quét lại thẻ để xác thực" : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
          {/* The one place to start a scan, sitting directly above everything it
              fills - so it is obvious that it fills the personal details too. */}
          <button
            type="button"
            onClick={() => setOcrOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl border border-clinical-200 bg-clinical-50/60 px-4 py-3 text-left transition-colors hover:border-clinical-400 hover:bg-clinical-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-clinical-600 shadow-sm">
              <ScanLine className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-clinical-800">
                Quét thẻ BHYT / CCCD tự động điền
              </span>
              <span className="block text-xs text-slate-500">
                Chụp hoặc tải ảnh thẻ - thông tin cá nhân và thẻ BHYT được điền
                tự động.
              </span>
            </span>
            <IdCard
              className="ml-auto h-5 w-5 shrink-0 text-clinical-400"
              aria-hidden="true"
            />
          </button>

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
            <div className="flex flex-wrap items-center gap-2 border-b border-clinical-100 bg-gradient-to-r from-clinical-50 to-emerald-50 px-6 py-4">
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
              {/* Verification as a badge rather than its own panel: it is a state
                  of the card number below, not a separate thing to act on. */}
              <span className="ml-auto">
                <VerificationBadge verified={verified} />
              </span>
            </div>

            <div className="space-y-5 p-6">
              {/* The saved card, whenever there is a number to draw - not only
                  once it is verified. A patient who typed the number in still
                  benefits from seeing the card the rest of the form describes;
                  the badge is what tells the two states apart. Driven by the
                  form, so it can never disagree with what is about to be
                  submitted. */}
              {insuranceFilled && (
                <BhyCardPreview
                  fullName={form.fullName}
                  insuranceCode={trimmedInsurance}
                  dateOfBirthLabel={dobLabelFrom(form.dateOfBirth)}
                  gender={
                    GENDER_OPTIONS.find((o) => o.value === form.gender)?.label ??
                    ""
                  }
                  address={form.address}
                  hospital={hospitalLabelFrom(form.initialHospitalCode)}
                  validityDisplay={validity?.display}
                  verified={verified}
                />
              )}

              {insuranceFilled && (
                <dl className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2">
                  <ScanOnlyDetail
                    label="Thời hạn giá trị sử dụng"
                    value={validity?.display}
                    emptyHint="Quét thẻ để đọc thời hạn trên thẻ."
                  />
                  <ScanOnlyDetail
                    label="Thời điểm đủ 05 năm liên tục"
                    value={
                      validity
                        ? validity.meetsFiveYears
                          ? "Đủ 05 năm liên tục"
                          : "Chưa đủ 05 năm liên tục"
                        : undefined
                    }
                    emptyHint="Quét thẻ để kiểm tra thời hạn đóng."
                  />
                  <p className="text-xs text-slate-500 sm:col-span-2">
                    Hai mục này được đọc từ ảnh thẻ khi quét, không lưu vào hồ sơ
                    - vì vậy chúng hiển thị lại sau khi tải trang.
                  </p>
                </dl>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Số CCCD / Mã định danh (12 số)"
                  htmlFor="identityCardNumber"
                  inputMode="numeric"
                  error={errors.identityCardNumber}
                  value={form.identityCardNumber}
                  placeholder="079xxxxxxxx"
                  onChange={(value) =>
                    set("identityCardNumber", digitsOnly(value))
                  }
                />
                <Field
                  label="Mã số thẻ BHYT (15 ký tự chuẩn)"
                  htmlFor="insuranceCode"
                  error={errors.insuranceCode}
                  value={form.insuranceCode}
                  placeholder="VD: DN 4 79 79 12345678"
                  mono
                  onChange={(value) =>
                    set("insuranceCode", sanitizeInsuranceCode(value))
                  }
                  hint={
                    insuranceHint ||
                    "Để trống nếu bạn không sử dụng BHYT"
                  }
                />

                <div className="sm:col-span-2">
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
                  {/* The benefit explainer, folded down to one caption under the
                      field it qualifies - the full percentages ride along in the
                      tooltip for anyone who wants the detail. */}
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
                    <ShieldCheck
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clinical-500"
                      aria-hidden="true"
                    />
                    <span title="Đúng tuyến: BHYT chi trả 80% - 100% chi phí khám chữa bệnh theo danh mục Bộ Y tế. Trái tuyến: BHYT hỗ trợ 40% chi phí.">
                      {selectedHospital
                        ? selectedHospital.label.includes("Trái tuyến")
                          ? "Thẻ đang đăng ký tại cơ sở trái tuyến: BHYT hỗ trợ 40% chi phí khám chữa bệnh."
                          : "Thẻ đang đăng ký đúng tuyến: BHYT chi trả 80% chi phí khám chữa bệnh trong phạm vi đã quy định."
                        : "Đúng tuyến BHYT chi trả 80% - 100% chi phí, trái tuyến hỗ trợ 40%."}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* One primary action. Saving is destructive to nothing and reversible
              only by editing the fields, so it stays explicit and alone. */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-clinical-600 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-clinical-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {saving ? "Đang lưu..." : "Lưu Thông Tin Hồ Sơ & BHYT"}
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
                  Quét thẻ BHYT / CCCD
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

/**
 * Whether the stored card scan still matches the number on screen.
 *
 * Deliberately one line: a separate "verified" and "matches" flag pair invites
 * the two to disagree, and the only combination worth showing is the one where
 * the card the patient is being billed against is the card that was read.
 */
function VerificationBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      Đã xác thực BHYT
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
      Chưa xác thực
    </span>
  );
}

/**
 * A value that only exists while a card is on screen.
 *
 * Rendered as text rather than as an input on purpose: there is no column behind
 * it, so an editable field would promise a value that silently does not survive a
 * reload. `emptyHint` says what to do instead of leaving a blank cell.
 */
function ScanOnlyDetail({
  label,
  value,
  emptyHint,
}: {
  label: string;
  value?: string;
  emptyHint: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${value ? "font-semibold text-slate-900" : "text-slate-500"}`}>
        {value || emptyHint}
      </dd>
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