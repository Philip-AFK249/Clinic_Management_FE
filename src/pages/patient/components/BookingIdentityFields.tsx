import { sanitizeInsuranceCode } from "../data/patientProfile";

/**
 * The slice of the booking form that a BHYT scan fills.
 *
 * Declared here rather than in `BookingPage` so the inputs and their owner
 * cannot drift apart: the page imports this type for its `formData` state.
 */
export interface BookingIdentityFieldsValue {
  fullName: string;
  phone: string;
  /** The grouped form, e.g. `HC 4 91 53 61000392`. */
  insuranceCode: string;
  /** `YYYY-MM-DD`, ready for `<input type="date">`. */
  dateOfBirth: string;
  /** As printed on the card: `Nam` / `Nữ`. */
  gender: string;
  address: string;
  /** `code (facility)`, e.g. `79-014 (BV Đa Khoa Sài Gòn)`. */
  initialHospitalCode: string;
}

interface BookingIdentityFieldsProps {
  value: BookingIdentityFieldsValue;
  onChange: <K extends keyof BookingIdentityFieldsValue>(
    field: K,
    next: BookingIdentityFieldsValue[K],
  ) => void;
  /**
   * Namespace for the input `id`s. Needed because step 1 and step 3 both mount
   * these fields, and duplicate ids would break the `<label for>` wiring.
   */
  idPrefix?: string;
}

const inputBase =
  "h-11 w-full rounded-lg border border-slate-200 bg-white py-2.5 px-4 text-base text-slate-900 placeholder-slate-400 transition-colors focus:border-clinical-600 focus:outline-none focus:ring-2 focus:ring-clinical-500/20";

const labelBase = "mb-1.5 block text-base font-medium text-slate-900";

/**
 * The patient's identity, editable.
 *
 * Everything here is autofillable from a scanned BHYT card, and everything here
 * is also typable by hand: the scan is a shortcut, not a gate, so each field
 * stays a plain controlled input bound to the booking form's state.
 */
export default function BookingIdentityFields({
  value,
  onChange,
  idPrefix = "booking",
}: BookingIdentityFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor={id("fullName")} className={labelBase}>
          Họ và Tên
        </label>
        <input
          id={id("fullName")}
          type="text"
          autoComplete="name"
          placeholder="Họ và tên của bạn"
          value={value.fullName}
          onChange={(e) => onChange("fullName", e.target.value)}
          className={inputBase}
        />
      </div>

      <div>
        <label htmlFor={id("phone")} className={labelBase}>
          Số điện thoại
        </label>
        <input
          id={id("phone")}
          type="tel"
          autoComplete="tel"
          placeholder="Ví dụ: 09xx xxx xxx"
          value={value.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          className={inputBase}
        />
        {/* A card carries no phone number, so this one is never autofilled. */}
        <p className="mt-1.5 text-xs text-slate-500">
          Thẻ BHYT không có số điện thoại - bạn cần nhập để chúng tôi gửi tin
          nhắn xác nhận.
        </p>
      </div>

      <div>
        <label htmlFor={id("dateOfBirth")} className={labelBase}>
          Ngày sinh
        </label>
        <input
          id={id("dateOfBirth")}
          type="date"
          value={value.dateOfBirth}
          onChange={(e) => onChange("dateOfBirth", e.target.value)}
          className={inputBase}
        />
      </div>

      <div>
        <label htmlFor={id("gender")} className={labelBase}>
          Giới tính
        </label>
        {/* A text input with suggestions rather than a `<select>`: the scan hands
            back whatever the card printed, and a select would silently display
            nothing if that were an unexpected word. */}
        <input
          id={id("gender")}
          type="text"
          list={`${idPrefix}-gender-options`}
          placeholder="Nam / Nữ"
          value={value.gender}
          onChange={(e) => onChange("gender", e.target.value)}
          className={inputBase}
        />
        <datalist id={`${idPrefix}-gender-options`}>
          <option value="Nam" />
          <option value="Nữ" />
          <option value="Khác" />
        </datalist>
      </div>

      <div>
        <label htmlFor={id("insuranceCode")} className={labelBase}>
          Mã số thẻ BHYT
        </label>
        <input
          id={id("insuranceCode")}
          type="text"
          placeholder="HC 4 91 53 61000392"
          value={value.insuranceCode}
          onChange={(e) =>
            onChange("insuranceCode", sanitizeInsuranceCode(e.target.value))
          }
          className={`${inputBase} font-mono uppercase`}
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={id("address")} className={labelBase}>
          Địa chỉ
        </label>
        <input
          id={id("address")}
          type="text"
          autoComplete="street-address"
          placeholder="Đường, phường/xã, quận/huyện, tỉnh/thành"
          value={value.address}
          onChange={(e) => onChange("address", e.target.value)}
          className={inputBase}
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={id("initialHospitalCode")} className={labelBase}>
          Nơi Đăng Ký Khám Chữa Bệnh Ban Đầu
        </label>
        <input
          id={id("initialHospitalCode")}
          type="text"
          placeholder="79-014 (BV Đa Khoa Sài Gòn)"
          value={value.initialHospitalCode}
          onChange={(e) => onChange("initialHospitalCode", e.target.value)}
          className={inputBase}
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Thẻ đăng ký đúng tuyến được BHYT chi trả 80% chi phí khám chữa bệnh.
        </p>
      </div>
    </div>
  );
}
