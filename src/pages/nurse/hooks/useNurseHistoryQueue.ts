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
  departmentId: number,
): NurseHistoryQueueState {
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loadedDepartment = useRef<number | null>(null);

  useEffect(() => {
    if (loadedDepartment.current !== departmentId) {
      loadedDepartment.current = departmentId;
      setTickets([]);
      setIsLoading(true);
    }

    const controller = new AbortController();
    const signal = controller.signal;

    async function load() {
      try {
        const history = await getReceptionHistoryQueueApi(
          departmentId,
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
  }, [departmentId, reloadToken]);

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
