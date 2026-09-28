import { useMemo } from "react";
import { useAuth } from "../../../context/useAuth";
import {
  initialsOf,
  resolveDoctorId,
  resolveDoctorProfile,
} from "../data/doctorDirectory";
import type { DoctorProfile } from "../data/doctorDirectory";

export interface DoctorSession {
  doctorId: number;
  profile: DoctorProfile;
  initials: string;
  /** False when the account is not a seeded `doctors` row. */
  isSeeded: boolean;
}

/**
 * Binds the signed-in account to a `doctors` row. Every doctor-portal surface
 * (queue polling, header identity, call-next) resolves through this so the
 * session can never drift from the auth context.
 */
export function useDoctorSession(): DoctorSession {
  const { user } = useAuth();

  return useMemo(() => {
    const doctorId = resolveDoctorId(user);
    const { profile, isSeeded } = resolveDoctorProfile(user, doctorId);
    return {
      doctorId,
      profile,
      isSeeded,
      initials: initialsOf(profile.fullName),
    };
  }, [user]);
}
