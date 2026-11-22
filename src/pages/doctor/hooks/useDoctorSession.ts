import { useMemo } from "react";
import { useAuth } from "../../../context/useAuth";
import {
  doctorProfileById,
  doctorsOfDepartment,
  initialsOf,
  resolveDoctorId,
  resolveDoctorProfile,
} from "../data/doctorDirectory";
import type { DoctorProfile } from "../data/doctorDirectory";
import { resolveNurse } from "../../reception/data/nurseDirectory";

export interface DoctorSession {
  doctorId: number;
  profile: DoctorProfile;
  initials: string;
  /** False when the account is not a seeded `doctors` row. */
  isSeeded: boolean;
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
      // A nurse's department is the block they staff. Default to its first
      // doctor, unless the workspace picker selected another room in the block.
      const blockDepartmentId =
        resolveNurse(user).departmentId ?? doctorId;
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
        initials: initialsOf(profile.fullName),
        isSeeded: Boolean(chosen),
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
      initials: initialsOf(profile.fullName),
      isSeeded,
      isNurseAssistant,
      blockDoctors: doctorsOfDepartment(profile.departmentId),
    };
  }, [doctorIdOverride, user]);
}
