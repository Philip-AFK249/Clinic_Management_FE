import { useCallback, useEffect, useRef, useState } from "react";
import { ClinicalApiError, getDoctorEncountersApi } from "../../../services/clinicalApi";
import type {
  EncounterResponse,
  PatientEncounterDto,
} from "../../../services/clinicalApi";

export interface DoctorEncounterHistory {
  encounters: PatientEncounterDto[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  prependEncounter: (encounter: EncounterResponse) => void;
}

/**
 * Encounters belonging to the signed-in doctor, newest first.
 *
 * The list is fetched on mount and can be refreshed after a visit is signed, so
 * the "Lịch sử đã khám" tab reflects the encounter that just completed without
 * a full page reload.
 */
export function useDoctorEncounterHistory(
  doctorId: number,
): DoctorEncounterHistory {
  const [encounters, setEncounters] = useState<PatientEncounterDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const hasLoaded = useRef(false);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  const prependEncounter = useCallback((encounter: EncounterResponse) => {
    setEncounters((current) => [
      encounter,
      ...current.filter((row) => row.encounterId !== encounter.encounterId),
    ]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      if (!hasLoaded.current) setIsLoading(true);
      try {
        const rows = await getDoctorEncountersApi(doctorId, controller.signal);
        if (cancelled) return;
        // The backend `LEFT JOIN FETCH` on diagnoses returns one row per
        // diagnosis, so collapse repeated encounter ids while preserving the
        // service's newest-first order.
        const byId = new Map<number, PatientEncounterDto>();
        for (const row of rows) {
          if (!byId.has(row.encounterId)) byId.set(row.encounterId, row);
        }
        setEncounters([...byId.values()]);
        setError(null);
        hasLoaded.current = true;
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof ClinicalApiError
            ? cause.message
            : "Không thể tải lịch sử khám của bác sĩ.",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [doctorId, reloadToken]);

  return { encounters, isLoading, error, refresh, prependEncounter };
}
