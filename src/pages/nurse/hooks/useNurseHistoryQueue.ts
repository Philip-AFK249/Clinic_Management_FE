import { useCallback, useEffect, useRef, useState } from "react";
import { getReceptionHistoryQueueApi, IntakeApiError } from "../../../services/intakeApi";
import type { QueueTicket } from "../../../services/intakeApi";

const POLL_INTERVAL_MS = 10_000;

export interface NurseHistoryQueueState {
  tickets: QueueTicket[];
  isLoading: boolean;
  isOffline: boolean;
  error: string;
  lastUpdatedAt: Date | null;
  refresh: () => void;
}

export function useNurseHistoryQueue(
  departmentId: number | null | undefined,
): NurseHistoryQueueState {
  // `0` is what a roster entry without a department resolves to, and sending it
  // as a filter would ask the service for a department that cannot exist. Omit
  // the param instead so the station sees clinic-wide history.
  const scopedDepartmentId =
    typeof departmentId === "number" && departmentId > 0
      ? departmentId
      : null;

  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loadedDepartment = useRef<number | null>(null);

  useEffect(() => {
    if (loadedDepartment.current !== scopedDepartmentId) {
      loadedDepartment.current = scopedDepartmentId;
      setTickets([]);
      setIsLoading(true);
    }

    const controller = new AbortController();
    const signal = controller.signal;

    async function load() {
      try {
        const history = await getReceptionHistoryQueueApi(
          scopedDepartmentId,
          undefined,
          signal,
        );
        if (signal.aborted) return;
        setTickets(history);
        setIsOffline(false);
        setError("");
        setLastUpdatedAt(new Date());
      } catch (cause) {
        if (signal.aborted) return;
        setIsOffline(true);
        setError(
          cause instanceof IntakeApiError
            ? cause.message
            : "Không tải được lịch sử phiếu đã hoàn tất.",
        );
        setLastUpdatedAt(new Date());
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [scopedDepartmentId, reloadToken]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    tickets,
    isLoading,
    isOffline,
    error,
    lastUpdatedAt,
    refresh,
  };
}
