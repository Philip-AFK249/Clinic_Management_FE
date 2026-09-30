import type { Gender } from "../../../types/auth";

/**
 * Nơi Đăng Ký Khám Chữa Bệnh Ban Đầu options, keyed by the bare mã cơ sở so the
 * select value stays comparable with what the OCR scan returns.
 */
export const BHYT_INITIAL_HOSPITALS: { code: string; label: string }[] = [
  { code: "79-014", label: "79-014 - BV Đa Khoa Sài Gòn (Đúng tuyến 80%)" },
  { code: "01-002", label: "01-002 - BV Bạch Mai (Đúng tuyến 80%)" },
  { code: "79-021", label: "79-021 - BV Nhi Đồng 2 (Đúng tuyến 80%)" },
  { code: "79-018", label: "79-018 - BV FV (Trái tuyến 40%)" },
];

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "OTHER", label: "Khác" },
];

/** A BHYT card number is 15 alphanumeric characters; spaces are cosmetic. */
export const INSURANCE_CODE_LENGTH = 15;
/** A CCCD / mã định danh is 12 digits. */
export const NATIONAL_ID_LENGTH = 12;

/** Upper-case and drop anything a printed BHYT card cannot contain. */
export function sanitizeInsuranceCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The digits of a CCCD, ignoring whatever separators were typed. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * OCR reads the card as it is printed - upper case - so folding the result back
 * to title case keeps the patient's name in the shape the rest of the UI uses.
 */
export function toNameCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase());
}

/**
 * The OCR payload carries the hospital as `"79-014 (BV Đa Khoa Sài Gòn)"`;
 * the select needs the bare code to match an option.
 */
export function hospitalCodeFrom(raw: string): string {
  return /^(\d{2}-\d{3})/.exec(raw.trim())?.[1] ?? "";
}