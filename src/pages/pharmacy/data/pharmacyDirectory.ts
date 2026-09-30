import type { User } from "../../../types/auth";

/**
 * Single source of truth for "which pharmacist am I?".
 *
 * Mirrors `pages/doctor/data/doctorDirectory.ts`: the auth payload carries a
 * UUID for `users.id`, but `POST /pharmacy/prescriptions/{id}/dispense` stamps
 * a numeric `pharmacistId` on the prescription, so the staff account has to be
 * linked to a pharmacy roster row.
 */
export interface PharmacistProfile {
  /** `pharmacists.id`, recorded on every dispensed prescription. */
  id: number;
  fullName: string;
  email: string;
}

/**
 * Used by an anonymous session or a login missing from the roster below.
 * Matches the `pharmacists.id` seeded by the schedule service so a signed-out
 * kiosk session stamps the same id as a real dược sĩ.
 */
export const FALLBACK_PHARMACIST_ID = 20;

/**
 * Mirrors the `pharmacists` seed rows. The email must match the `users.email`
 * AuthService authenticates, because the id is resolved from the account before
 * any roster column exists on the token.
 */
export const PHARMACIST_DIRECTORY: PharmacistProfile[] = [
  {
    id: 20,
    fullName: "DS. Đặng Thu Thảo",
    email: "thao.dang@smartclinic.vn",
  },
];

const PHARMACIST_BY_EMAIL = new Map(
  PHARMACIST_DIRECTORY.map(
    (pharmacist) => [pharmacist.email.toLowerCase(), pharmacist],
  ),
);

/** Roster row for a staff account email, if one is seeded. */
export function pharmacistIdFor(email: string): number | undefined {
  return PHARMACIST_BY_EMAIL.get(email.trim().toLowerCase())?.id;
}

/**
 * Order of precedence: `user.pharmacistId` (set by the real auth backend when it
 * links an account to a roster row), then the email directory, then the
 * fallback.
 */
export function resolvePharmacistId(user: User | null | undefined): number {
  if (!user || user.role !== "PHARMACIST") return FALLBACK_PHARMACIST_ID;
  if (typeof user.pharmacistId === "number" && Number.isFinite(user.pharmacistId)) {
    return user.pharmacistId;
  }
  return pharmacistIdFor(user.email) ?? FALLBACK_PHARMACIST_ID;
}

/** "DS. Đặng Thu Thảo" -> "TT"; never empty, so the header avatar stays sized. */
export function pharmacistInitials(fullName: string): string {
  const words = fullName
    .split(/\s+/)
    .map((word) => word.replace(/^(DS|KS|TS|ThS)\.?\s*/i, ""))
    .filter(Boolean);
  const letters = words.slice(-2).map((word) => word[0]?.toUpperCase() ?? "");
  return letters.join("") || "DS";
}
