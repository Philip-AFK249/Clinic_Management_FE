import { useMemo } from "react";
import { useAuth } from "../../../context/useAuth";
import {
  departmentNameOf,
  doctorProfileById,
  doctorsOfDepartment,
  FALLBACK_DEPARTMENT_ID,
  initialsOf,
  resolveDoctorId,
  resolveDoctorProfile,
} from "../data/doctorDirectory";
import type { DoctorProfile } from "../data/doctorDirectory";
import { nurseFor, resolveNurse } from "../../reception/data/nurseDirectory";

/** Identity shown in the header - the signed-in user, never the borrowed doctor. */
export interface SessionIdentity {
  fullName: string;
  subtitle: string;
  roomNumber: string;
  departmentName: string;
  initials: string;
  isSeeded: boolean;
}

export interface DoctorSession {
  /** Queue-scoped doctor id; for an assistant this is the doctor they support. */
  doctorId: number;
  /** Queue-scoped doctor profile, used for encounter payloads and department. */
  profile: DoctorProfile;
  identity: SessionIdentity;
  /** True for "Y tá / Thư ký y khoa" assistants working inside the exam room. */
  isNurseAssistant: boolean;
  /** Doctors of the session's block, so an assistant can pick a room queue. */
  blockDoctors: DoctorProfile[];
}

/**
 * Binds the signed-in account to a `doctors` row. Every doctor-portal surface
 * (queue polling, header identity, call-next) resolves through this so the
 * session can never drift from the auth context.
 *
 * `doctorIdOverride` is used by the in-room assistant picker: a NURSE account
 * has no `doctors` row of its own, so it borrows the queue of the doctor whose
 * room it is supporting. Ordinary doctor sessions ignore it.
 */
export function useDoctorSession(doctorIdOverride?: number): DoctorSession {
  const { user } = useAuth();

  return useMemo(() => {
    const isNurseAssistant = user?.role === "NURSE";
    let doctorId = resolveDoctorId(user);

    if (isNurseAssistant) {
      // A nurse's department is the block they staff. Legacy `3` still arrives
      // on some accounts and is folded into Khối Nội like every other map.
      const nurse = resolveNurse(user);
      const rawBlockDepartmentId = nurse.departmentId ?? FALLBACK_DEPARTMENT_ID;
      const blockDepartmentId =
        rawBlockDepartmentId === 3 ? FALLBACK_DEPARTMENT_ID : rawBlockDepartmentId;
      const blockDoctors = doctorsOfDepartment(blockDepartmentId);
      const chosen =
        (doctorIdOverride !== undefined
          ? doctorProfileById(doctorIdOverride)
          : undefined) ??
        blockDoctors[0] ??
        doctorProfileById(doctorId);
      if (chosen) doctorId = chosen.id;
      const profile = chosen ?? resolveDoctorProfile(user, doctorId).profile;
      return {
        doctorId,
        profile,
        identity: {
          fullName: nurse.fullName,
          subtitle: nurse.title ?? "Y tá / Thư ký y khoa",
          roomNumber: nurse.roomNumber ?? "",
          departmentName: departmentNameOf(blockDepartmentId),
          // `initialsOf` only strips doctor ranks, so remove the Y tá prefix.
          initials: initialsOf(nurse.fullName.replace(/^Y tá\s*/i, "")),
          isSeeded: Boolean(user && nurseFor(user.email)),
        },
        isNurseAssistant,
        blockDoctors,
      };
    }

    if (doctorIdOverride !== undefined) {
      const chosen = doctorProfileById(doctorIdOverride);
      if (chosen) doctorId = chosen.id;
    }
    const { profile, isSeeded } = resolveDoctorProfile(user, doctorId);
    return {
      doctorId,
      profile,
      identity: {
        fullName: profile.fullName,
        subtitle: profile.credential || profile.title || "Bác sĩ",
        roomNumber: profile.roomNumber,
        departmentName: profile.departmentName,
        initials: initialsOf(profile.fullName),
        isSeeded,
      },
      isNurseAssistant,
      blockDoctors: doctorsOfDepartment(profile.departmentId),
    };
  }, [doctorIdOverride, user]);
}
