import type { AuthResponseDto } from "../../../services/authApi";

export type PatientFilter =
  | "ALL"
  | "HAS_BHYT"
  | "NO_BHYT"
  | "OCR_VERIFIED"
  | "LOCKED";

export const PATIENT_FILTERS: { value: PatientFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "HAS_BHYT", label: "Có BHYT" },
  { value: "NO_BHYT", label: "Chưa có BHYT" },
  { value: "OCR_VERIFIED", label: "Đã xác thực OCR" },
  { value: "LOCKED", label: "Đã khóa" },
];

export const GENDER_LABELS: Record<string, string> = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
};

export function genderLabel(gender: string | null | undefined): string | null {
  if (!gender) return null;
  return GENDER_LABELS[gender] ?? gender;
}

/** Up to two initials for the avatar chip. */
export function patientInitials(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
  return initials || "BN";
}

/**
 * Whole years between an ISO date and today, or `null` when the column is empty
 * or unparseable - the roster shows `--` rather than "NaN tuổi".
 */
export function ageFrom(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const birth = new Date(isoDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

function hasInsurance(patient: AuthResponseDto): boolean {
  return Boolean(patient.insuranceCode?.trim());
}

export function isLocked(patient: AuthResponseDto): boolean {
  // `active` is absent on the pre-upgrade payload; only an explicit false locks.
  return patient.active === false;
}

/**
 * Fold to letters and digits so a CCCD or BHYT number matches whether it was
 * typed or stored with separators ("079 012 345 678" == "079012345678").
 */
function loose(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function patientFilterCounts(
  patients: AuthResponseDto[],
): Record<PatientFilter, number> {
  const counts: Record<PatientFilter, number> = {
    ALL: patients.length,
    HAS_BHYT: 0,
    NO_BHYT: 0,
    OCR_VERIFIED: 0,
    LOCKED: 0,
  };
  for (const patient of patients) {
    if (hasInsurance(patient)) counts.HAS_BHYT += 1;
    else counts.NO_BHYT += 1;
    if (patient.isOcrVerified) counts.OCR_VERIFIED += 1;
    if (isLocked(patient)) counts.LOCKED += 1;
  }
  return counts;
}

export function matchesPatientFilter(
  patient: AuthResponseDto,
  filter: PatientFilter,
): boolean {
  switch (filter) {
    case "HAS_BHYT":
      return hasInsurance(patient);
    case "NO_BHYT":
      return !hasInsurance(patient);
    case "OCR_VERIFIED":
      return patient.isOcrVerified === true;
    case "LOCKED":
      return isLocked(patient);
    case "ALL":
    default:
      return true;
  }
}

export function matchesPatientSearch(
  patient: AuthResponseDto,
  query: string,
): boolean {
  const needle = query.trim();
  if (!needle) return true;

  const text = needle.toLowerCase();
  if (
    patient.fullName?.toLowerCase().includes(text) ||
    patient.email?.toLowerCase().includes(text) ||
    (patient.phone ?? "").toLowerCase().includes(text) ||
    (patient.address ?? "").toLowerCase().includes(text)
  ) {
    return true;
  }

  // Identifiers are compared separator-free, so a typed 12-digit CCCD finds a
  // stored "079 012 345 678" and a partially typed code still narrows the list.
  const code = loose(needle);
  if (!code) return false;
  return (
    loose(patient.identityCardNumber).includes(code) ||
    loose(patient.insuranceCode).includes(code)
  );
}

export function filterPatients(
  patients: AuthResponseDto[],
  query: string,
  filter: PatientFilter,
): AuthResponseDto[] {
  return patients.filter(
    (patient) =>
      matchesPatientFilter(patient, filter) && matchesPatientSearch(patient, query),
  );
}
