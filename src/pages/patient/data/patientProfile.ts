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

/**
 * The same fold for `Giới tính`: the card prints `Nam` / `Nữ`, while the profile
 * form stores the `Gender` enum behind a `<select>`.
 *
 * A word that matches neither maps to `OTHER` rather than to an empty value -
 * a `<select>` with no matching `<option>` silently renders blank, which would
 * look like the scan lost the field.
 */
export function genderFrom(raw: string): Gender {
  const value = raw.trim().toUpperCase();
  if (["NAM", "N", "M", "MALE"].includes(value)) return "MALE";
  if (["NỮ", "NU", "F", "FEMALE"].includes(value)) return "FEMALE";
  return "OTHER";
}

/**
 * The card prints a date of birth as `14/08/1984`, while the backend and every
 * form control store it as the ISO `1984-08-14`. Both paths have to render the
 * same on the shared card, so the card view takes whichever form it is given and
 * this folds ISO down to the printed one.
 *
 * Returns "" for anything that is not a whole `YYYY-MM-DD` date, so a blank
 * value never turns into a card reading `01/01/1970`.
 */
export function dobLabelFrom(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * The printable clinic name for a stored `initialHospitalCode`.
 *
 * The session holds the bare code, while a scan hands over the whole
 * `"79-014 (BV Đa Khoa Sài Gòn)"` string, so both go in and either can come out.
 * The "(Đúng tuyến 80%)" tail is dropped: it is a reimbursement rate, not
 * something printed on the card. An unknown code is shown as-is rather than
 * blanked - better a raw code than a card with a gap.
 */
export function hospitalLabelFrom(raw: string): string {
  const code = hospitalCodeFrom(raw) || raw.trim();
  if (!code) return "";
  const known = BHYT_INITIAL_HOSPITALS.find((h) => h.code === code);
  return known
    ? known.label.replace(/\s*\((?:Đúng|Trái) tuyến[^)]*\)/i, "").trim()
    : code;
}

/**
 * Whether the card's own validity window covers five years or more.
 *
 * Luật BHYT 2024: quyền lợi hưởng mức đóng cho 5 năm liên tục, and the card
 * prints the window rather than the years accumulated, so this reads the span off
 * it. Only a card that has actually been read carries the dates, so a hand-typed
 * number answers `false` - there is nothing on it to judge by.
 *
 * Compared as calendar years rather than by dividing the day count: five years is
 * 1826 or 1827 days depending on leap years, so a duration comparison misses the
 * exact case it is meant to catch.
 */
export function meetsFiveYearRule(
  validFrom?: string,
  validUntil?: string,
): boolean {
  const from = /^(\d{4})-(\d{2})-(\d{2})$/.exec(validFrom?.trim() ?? "");
  const until = /^(\d{4})-(\d{2})-(\d{2})$/.exec(validUntil?.trim() ?? "");
  if (!from || !until) return false;
  const start = new Date(Number(from[1]), Number(from[2]) - 1, Number(from[3]));
  const end = new Date(Number(until[1]), Number(until[2]) - 1, Number(until[3]));
  return end >= new Date(start.getFullYear() + 5, start.getMonth(), start.getDate());
}