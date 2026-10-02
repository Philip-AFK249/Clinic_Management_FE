import { useCallback, useEffect, useState } from "react";
import { getAllPatientsApi } from "../../../services/authApi";
import type { AuthResponseDto } from "../../../services/authApi";
import { useAuth } from "../../../context/useAuth";

export interface AdminPatients {
  /** Live PATIENT accounts; empty while the first request is still running. */
  patients: AuthResponseDto[];
  isLoading: boolean;
  /** Renderable failure reason, or `null` while the list is usable. */
  error: string | null;
  /** True when the request failed and no list can be shown at all. */
  isUnavailable: boolean;
  refresh: () => void;
  /**
   * Replace one patient in place, from the response of an edit. Keeps the table
   * correct without a second round trip; the caller can still `refresh()` to
   * re-read everything.
   */
  applyPatient: (patient: AuthResponseDto) => void;
}

/**
 * Live patient roster for the admin console, read from AuthService.
 *
 * Unlike the staff tab - which is still seeded from `MOCK_STAFF` - this list is
 * the real one, so it is fetched on mount and re-read after every mutation.
 *
 * The list is intentionally NOT cached at module scope (the way the drug
 * catalog is): an admin editing a patient is mutating exactly this data, and a
 * shared cache would let a second screen overwrite a fresh edit with a stale
 * read.
 */
export function useAdminPatients(): AdminPatients {
  const { user } = useAuth();
  const token = user?.token;
  const [patients, setPatients] = useState<AuthResponseDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  const applyPatient = useCallback((patient: AuthResponseDto) => {
    setPatients((prev) =>
      prev.map((existing) =>
        existing.userId === patient.userId ? { ...existing, ...patient } : existing,
      ),
    );
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getAllPatientsApi(token).then(
      (list) => {
        if (cancelled) return;
        setPatients(list);
        setError(null);
      },
      (cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Không tải được danh sách bệnh nhân từ AuthService.",
        );
      },
    );

    return () => {
      cancelled = true;
    };
  }, [token, reloadToken]);

  return {
    patients,
    // Nothing to render yet and no failure to explain: still loading.
    isLoading: patients.length === 0 && error === null,
    error,
    isUnavailable: error !== null && patients.length === 0,
    refresh,
    applyPatient,
  };
}
