import type { User } from "../../../types/auth";
import {
  departmentNameOf,
  FALLBACK_DEPARTMENT_ID,
} from "../../doctor/data/doctorDirectory";

/**
 * Single source of truth for "which nurse am I?".
 *
 * Mirrors `pages/pharmacy/data/pharmacyDirectory.ts`: the staff account email is
 * the only stable join key until the auth backend returns a roster id. Unlike
 * doctors and pharmacists there is no `nurses` table yet, so the roster below
 * is the demo seed and the id is only meaningful inside this app.
 */
export interface NurseProfile {
  id: number;
  fullName: string;
  email: string;
  /** Khoa the nurse is posted to; drives the triage desk they land on. */
  departmentId: number;
}

/** Used by an anonymous session or a login missing from the roster below. */
export const FALLBACK_NURSE_ID = 1;

/** Mirrors the seeded điều dưỡng accounts. */
export const NURSE_DIRECTORY: NurseProfile[] = [
  {
    id: 1,
    fullName: "ĐD. Trịnh Thu Hằng",
    email: "hang.trinh@smartclinic.vn",
    departmentId: 1,
  },
];

/** Stand-in identity for a session whose email is not on the roster. */
export const FALLBACK_NURSE: NurseProfile = NURSE_DIRECTORY[0];

const NURSE_BY_EMAIL = new Map(
  NURSE_DIRECTORY.map((nurse) => [nurse.email.toLowerCase(), nurse]),
);

/** Roster row for a staff account email, if one is seeded. */
export function nurseFor(email: string): NurseProfile | undefined {
  return NURSE_BY_EMAIL.get(email.trim().toLowerCase());
}

/** Khoa name for a nurse, resolved against the shared department registry. */
export function nurseDepartmentName(nurse: NurseProfile | undefined): string {
  return departmentNameOf(nurse?.departmentId ?? FALLBACK_DEPARTMENT_ID);
}

/**
 * The nurse to render for a session: the email directory wins, and anything
 * unrecognised falls back to the seeded triage-desk nurse so the header is
 * never blank. There is no `nurses` table to look a numeric id up in yet, so
 * `User` deliberately carries only `departmentId` for this role.
 */
export function resolveNurse(user: User | null | undefined): NurseProfile {
  if (!user || user.role !== "NURSE") return FALLBACK_NURSE;
  return nurseFor(user.email) ?? FALLBACK_NURSE;
}
