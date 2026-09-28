import { useCallback, useEffect, useRef, useState } from "react";
import { getAvailableSlots } from "../../../services/intakeApi";
import type { TimeSlotResponse } from "../../../services/intakeApi";
import { buildFallbackSlots } from "../data/receptionMockData";

interface LoadedSlots {
  /** Identifies the request these slots belong to. */
  key: string;
  slots: TimeSlotResponse[];
  error: string;
  isOffline: boolean;
  loadedAt: Date;
}

const EMPTY: LoadedSlots = {
  key: "",
  slots: [],
  error: "",
  isOffline: false,
  loadedAt: new Date(0),
};

export interface AvailableSlotsState {
  slots: TimeSlotResponse[];
  isLoading: boolean;
  /** Human-readable error, already localized. Empty when the last load worked. */
  error: string;
  /** True while serving synthesized slots because the backend is unreachable. */
  isOffline: boolean;
  refresh: () => void;
  lastLoadedAt: Date | null;
}

/**
 * Loads the 60-minute slot grid for a department/day. Falls back to a
 * synthesized grid (clearly flagged via `isOffline`) so the desk stays usable
 * while PatientIntakeService is down.
 *
 * The loading flag is derived from the request key rather than stored, so a
 * department switch flips it without a cascading render.
 */
export function useAvailableSlots(
  departmentId: number,
  date: string,
  enabled = true,
): AvailableSlotsState {
  const [loaded, setLoaded] = useState<LoadedSlots>(EMPTY);
  const [reloadToken, setReloadToken] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);

  const requestKey =
    enabled && departmentId && date ? `${departmentId}|${date}|${reloadToken}` : null;

  useEffect(() => {
    if (!requestKey || !departmentId || !date) return undefined;

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;

    getAvailableSlots(departmentId, date, controller.signal)
      .then((slots) => {
        if (controller.signal.aborted) return;
        setLoaded({
          key: requestKey,
          slots,
          error: "",
          isOffline: false,
          loadedAt: new Date(),
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          key: requestKey,
          slots: buildFallbackSlots(departmentId),
          error:
            cause instanceof Error
              ? cause.message
              : "Không tải được khung giờ khả dụng.",
          isOffline: true,
          loadedAt: new Date(),
        });
      });

    return () => controller.abort();
  }, [date, departmentId, requestKey]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  // Slots from a previous department are kept on screen while the new grid loads.
  const isLoading = requestKey !== null && loaded.key !== requestKey;

  return {
    slots: loaded.slots,
    isLoading,
    error: loaded.key === requestKey ? loaded.error : "",
    isOffline: loaded.key === requestKey ? loaded.isOffline : false,
    refresh,
    lastLoadedAt: loaded.loadedAt.getTime() === 0 ? null : loaded.loadedAt,
  };
}
