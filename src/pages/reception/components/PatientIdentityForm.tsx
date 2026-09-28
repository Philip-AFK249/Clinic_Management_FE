import { UserRound } from "lucide-react";
import FormField from "./FormField";
import { controlClass } from "../formStyles";
import type {
  IntakeErrors,
  IntakeField,
  IntakeFormState,
} from "../hooks/useIntakeForm";
import { GENDER_OPTIONS } from "../data/receptionMockData";

interface PatientIdentityFormProps {
  form: IntakeFormState;
  errors: IntakeErrors;
  onChange: <K extends keyof IntakeFormState>(
    field: K,
    value: IntakeFormState[K],
  ) => void;
  /** Validates just this field once the secretary leaves it. */
  onFieldBlur: (field: IntakeField) => void;
}

export default function PatientIdentityForm({
  form,
  errors,
  onChange,
  onFieldBlur,
}: PatientIdentityFormProps) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-sm font-bold text-slate-900">
            Thông tin Hành Chính Bệnh Nhân
          </h2>
        </div>
        {form.isOcrVerified && (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            Đã xác thực OCR
          </span>
        )}
      </div>

      <div className="grid gap-x-3 sm:grid-cols-2">
        <FormField
          label="Họ và tên"
          htmlFor="intake-fullName"
          error={errors.fullName}
          required
          hint="Ghi đúng như trên thẻ / CCCD"
        >
          <input
            id="intake-fullName"
            type="text"
            className={controlClass(Boolean(errors.fullName))}
            placeholder="NGUYỄN VĂN A"
            value={form.fullName}
            onChange={(event) => onChange("fullName", event.target.value)}
            onBlur={() => onFieldBlur("fullName")}
          />
        </FormField>

        <FormField
          label="Giới tính"
          htmlFor="intake-gender"
          error={errors.gender}
        >
          <select
            id="intake-gender"
            className={controlClass(false)}
            value={form.gender}
            onChange={(event) => onChange("gender", event.target.value)}
            onBlur={() => onFieldBlur("gender")}
          >
            <option value="">-- Chọn --</option>
            {GENDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Số CCCD / CMND"
          htmlFor="intake-identityCardNumber"
          error={errors.identityCardNumber}
          hint="12 chữ số"
        >
          <input
            id="intake-identityCardNumber"
            type="text"
            inputMode="numeric"
            maxLength={12}
            className={`${controlClass(Boolean(errors.identityCardNumber))} font-mono`}
            placeholder="079079001234"
            value={form.identityCardNumber}
            onChange={(event) =>
              onChange(
                "identityCardNumber",
                event.target.value.replace(/\D/g, "").slice(0, 12),
              )
            }
            onBlur={() => onFieldBlur("identityCardNumber")}
          />
        </FormField>

        <FormField
          label="Ngày sinh"
          htmlFor="intake-dateOfBirth"
          error={errors.dateOfBirth}
        >
          <input
            id="intake-dateOfBirth"
            type="date"
            className={controlClass(Boolean(errors.dateOfBirth))}
            value={form.dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => onChange("dateOfBirth", event.target.value)}
            onBlur={() => onFieldBlur("dateOfBirth")}
          />
        </FormField>

        <FormField
          label="Mã thẻ BHYT"
          htmlFor="intake-insuranceCode"
          error={errors.insuranceCode}
          hint="15 ký tự: 2 chữ cái + 13 chữ số"
        >
          <input
            id="intake-insuranceCode"
            type="text"
            maxLength={20}
            className={`${controlClass(Boolean(errors.insuranceCode))} font-mono uppercase`}
            placeholder="DN 4 79 79 12345678"
            value={form.insuranceCode}
            onChange={(event) => onChange("insuranceCode", event.target.value)}
            onBlur={() => onFieldBlur("insuranceCode")}
          />
        </FormField>

        <FormField
          label="Mã cơ quan BHYT"
          htmlFor="intake-initialHospitalCode"
          error={errors.initialHospitalCode}
        >
          <input
            id="intake-initialHospitalCode"
            type="text"
            className={controlClass(false)}
            placeholder="79-014"
            value={form.initialHospitalCode}
            onChange={(event) =>
              onChange("initialHospitalCode", event.target.value)
            }
            onBlur={() => onFieldBlur("initialHospitalCode")}
          />
        </FormField>

        <FormField
          label="Nơi KCB ban đầu"
          htmlFor="intake-initialHospital"
          error={errors.initialHospitalCode}
        >
          <input
            id="intake-initialHospital"
            type="text"
            className={controlClass(false)}
            placeholder="BV Đa Khoa Sài Gòn"
            value={
              form.initialHospitalCode.includes("(")
                ? form.initialHospitalCode.replace(/^.*\((.*)\)$/, "$1")
                : ""
            }
            onChange={(event) => {
              const name = event.target.value.trim();
              const code = form.initialHospitalCode.split("(")[0].trim();
              onChange(
                "initialHospitalCode",
                name ? `${code} (${name})` : code,
              );
            }}
          />
        </FormField>

        <FormField
          label="Số điện thoại"
          htmlFor="intake-phone"
          error={errors.phone}
          hint="10 chữ số, đầu 03 / 05 / 07 / 08 / 09"
        >
          <input
            id="intake-phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            className={`${controlClass(Boolean(errors.phone))} font-mono`}
            placeholder="0905123456"
            value={form.phone}
            onChange={(event) =>
              onChange("phone", event.target.value.replace(/\D/g, "").slice(0, 10))
            }
            onBlur={() => onFieldBlur("phone")}
          />
        </FormField>

        <div className="sm:col-span-2">
          <FormField
            label="Địa chỉ"
            htmlFor="intake-address"
            error={errors.address}
            hint="Dùng cho hồ sơ bệnh án điện tử"
          >
            <input
              id="intake-address"
              type="text"
              className={controlClass(false)}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
              value={form.address}
              onChange={(event) => onChange("address", event.target.value)}
            onBlur={() => onFieldBlur("address")}
            />
          </FormField>
        </div>
      </div>
    </section>
  );
}
