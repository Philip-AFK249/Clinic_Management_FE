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
  /** Academic credential on the staff account, e.g. "Cử nhân Điều dưỡng". */
  title?: string;
  /** Post / station the nurse works at, e.g. "Phòng khám 101". */
  roomNumber?: string;
}

/** Used by an anonymous session or a login missing from the roster below. */
export const FALLBACK_NURSE_ID = 1;

/** Mirrors the nine seeded điều dưỡng accounts (`users.id` 11 -> 19). */
export const NURSE_DIRECTORY: NurseProfile[] = [
  {
    id: 1,
    fullName: "ĐD. Trịnh Thu Hằng",
    email: "hang.trinh@smartclinic.vn",
    departmentId: 1,
    title: "Cử nhân Điều dưỡng",
    roomNumber: "Phòng khám 101",
  },
  {
    id: 2,
    fullName: "ĐD. Đỗ Phương Mai",
    email: "mai.do@smartclinic.vn",
    departmentId: 2,
    title: "Cử nhân Điều dưỡng",
    roomNumber: "Phòng khám 201",
  },
  {
    id: 3,
    fullName: "ĐD. Nguyễn Thảo Ly",
    email: "ly.nguyen@smartclinic.vn",
    departmentId: 3,
    title: "Cử nhân Điều dưỡng",
    roomNumber: "Phòng khám 205",
  },
  {
    id: 4,
    fullName: "ĐD. Trần Kim Oanh",
    email: "oanh.tran@smartclinic.vn",
    departmentId: 1,
    title: "Cử nhân Điều dưỡng",
    roomNumber: "Phòng Cấp cứu & Điện tim",
  },
  {
    id: 5,
    fullName: "ĐD. Lê Phương Thảo",
    email: "thao.le@smartclinic.vn",
    departmentId: 2,
    title: "Cử nhân Điều dưỡng",
    roomNumber: "Buồng Test dị nguyên & Hô hấp ký",
  },
  {
    id: 6,
    fullName: "ĐD. Phạm Yến Nhi",
    email: "nhi.pham@smartclinic.vn",
    departmentId: 3,
    title: "Cao đẳng Điều dưỡng",
    roomNumber: "Buồng Tiểu phẫu & Laser da",
  },
  {
    id: 7,
    fullName: "ĐD. Vũ Thùy Linh",
    email: "linh.vu@smartclinic.vn",
    departmentId: 1,
    title: "Cử nhân Điều dưỡng",
    roomNumber: "Quầy Tiếp đón Sảnh A",
  },
  {
    id: 8,
    fullName: "ĐD. Bùi Ánh Ngọc",
    email: "ngoc.bui@smartclinic.vn",
    departmentId: 2,
    title: "Cao đẳng Điều dưỡng",
    roomNumber: "Khu Kiosk Tự phục vụ",
  },
  {
    id: 9,
    fullName: "ĐD. Hoàng Bích Trâm",
    email: "tram.hoang@smartclinic.vn",
    departmentId: 3,
    title: "Cao đẳng Điều dưỡng",
    roomNumber: "Bàn Đo Dấu hiệu Sinh tồn",
  },
];

/** Stand-in identity for a session whose email is not on the roster. */
export const FALLBACK_NURSE: NurseProfile = NURSE_DIRECTORY[0]!;

const NURSE_BY_EMAIL = new Map(
  NURSE_DIRECTORY.map((nurse) => [nurse.email.toLowerCase(), nurse]),
);

/** Roster row for a staff account email, if one is seeded. */
export function nurseFor(email: string): NurseProfile | undefined {
  return NURSE_BY_EMAIL.get(email.trim().toLowerCase());
}

/** Roster rows posted to one khoa, in `nurses.id` order - drives admin pairing. */
export function nursesOfDepartment(departmentId: number): NurseProfile[] {
  return NURSE_DIRECTORY.filter(
    (nurse) => nurse.departmentId === departmentId,
  );
}

/** Khoa name for a nurse, resolved against the shared department registry. */
export function nurseDepartmentName(nurse: NurseProfile | undefined): string {
  return departmentNameOf(nurse?.departmentId ?? FALLBACK_DEPARTMENT_ID);
}

/**
 * The nurse to render for a session: the email directory wins, and an
 * unrecognised account still resolves to its own account fields so a nurse
 * signed in from another environment is never shown as a colleague (only the
 * room/title, which live in this roster, go blank). There is no `nurses` table
 * to look a numeric id up in yet, so `User` deliberately carries only
 * `departmentId` for this role.
 */
export function resolveNurse(user: User | null | undefined): NurseProfile {
  if (!user || user.role !== "NURSE") return FALLBACK_NURSE;
  const known = nurseFor(user.email);
  if (known) return known;
  return {
    id: FALLBACK_NURSE_ID,
    fullName: user.fullName,
    email: user.email,
    departmentId: user.departmentId ?? FALLBACK_DEPARTMENT_ID,
  };
}
