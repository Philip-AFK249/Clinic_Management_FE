import { useMemo } from "react";
import { useAuth } from "../../../context/useAuth";
import {
  pharmacistInitials,
  resolvePharmacistId,
} from "../data/pharmacyDirectory";

export interface PharmacySession {
  pharmacistId: number;
  pharmacistName: string;
  initials: string;
  /** False when the account is not a seeded `pharmacists` row. */
  isSeeded: boolean;
}

/**
 * Binds the signed-in account to the pharmacy roster so the dispense call is
 * attributed to the pharmacist who actually handed the drugs over.
 */
export function usePharmacySession(): PharmacySession {
  const { user } = useAuth();

  return useMemo(() => {
    const pharmacistId = resolvePharmacistId(user);
    const pharmacistName =
      user?.fullName?.trim() || "Dược sĩ phụ trách cấp phát";
    return {
      pharmacistId,
      pharmacistName,
      initials: pharmacistInitials(pharmacistName),
      isSeeded: user?.role === "PHARMACIST",
    };
  }, [user]);
}
