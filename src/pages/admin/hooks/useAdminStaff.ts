import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { getAllStaffApi } from "../../../services/authApi";
import type { AuthResponseDto } from "../../../services/authApi";
import { useAuth } from "../../../context/useAuth";
import { isStaffAccount } from "../data/staffFilters";

export interface AdminStaff {
  /** Live staff accounts; empty while the first request is still running. */
  staff: AuthResponseDto[];
  isLoading: boolean;
  /** Renderable failure reason, or `null` while the list is usable. */
  error: string | null;
  /** True when the request failed and no list can be shown at all. */
  isUnavailable: boolean;
  refresh: () => void;
  /**
   * Replace one account in place, from the response of a lock / unlock or an
   * edit. Keeps the table correct without a second round trip; the caller can
   * still `refresh()` to re-read everything.
   */
  applyStaff: (staff: AuthResponseDto) => void;
  /**
   * Insert a freshly created account. Used so a new row shows up immediately
   * instead of waiting for a full re-read.
   */
  addStaff: (staff: AuthResponseDto) => void;
}

/**
 * Live staff roster for the admin console, read from AuthService (:8085).
 *
 * `GET /auth/admin/users` answers with every account, patients included, so the
 * patient rows are dropped here - the console shows them in the patient roster
 * tab instead.
 *
 * Like the patient roster, this list is intentionally not cached at module scope:
 * an admin locking an account is mutating exactly this data, and a shared cache
 * would let a second screen overwrite a fresh edit with a stale read.
 */
export function useAdminStaff(): AdminStaff {
  const { user } = useAuth();
  const token = user?.token;
  const [staff, setStaff] = useState<AuthResponseDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);

  const applyStaff = useCallback((updated: AuthResponseDto) => {
    setStaff((prev) =>
      prev
        .map((existing) =>
          existing.userId === updated.userId
            ? { ...existing, ...updated }
            : existing,
        )
        .filter(isStaffAccount),
    );
  }, []);

  const addStaff = useCallback((created: AuthResponseDto) => {
    setStaff((prev) =>
      isStaffAccount(created)
        ? [...prev.filter((u) => u.userId !== created.userId), created]
        : prev,
    );
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getAllStaffApi(token).then(
      (list) => {
        if (cancelled) return;
        setStaff(list.filter(isStaffAccount));
        setError(null);
      },
      (cause: unknown) => {
        if (cancelled) return;
        if (axios.isCancel(cause)) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Không tải được danh sách nhân sự từ AuthService.",
        );
      },
    );

    return () => {
      cancelled = true;
    };
  }, [token, reloadToken]);

  return {
    staff,
    // Nothing to render yet and no failure to explain: still loading.
    isLoading: staff.length === 0 && error === null,
    error,
    isUnavailable: error !== null && staff.length === 0,
    refresh,
    applyStaff,
    addStaff,
  };
}
