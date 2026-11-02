import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getReceptionQueue,
  getReceptionUpcomingQueue,
  updateTicketStatus,
} from "../../../services/intakeApi";
import { IntakeApiError } from "../../../services/intakeApi";
import type { QueueStatus, QueueTicket } from "../../../services/intakeApi";
import { RECEPTION_DEPARTMENTS, buildFallbackQueue } from "../data/receptionMockData";
import type { QueueDateFilter } from "../data/queueDates";

const POLL_INTERVAL_MS = 10_000;

export type QueueScope = "ALL" | number;

export interface ReceptionQueueState {
  tickets: QueueTicket[];
  /** Triage weight P1 -> P2 -> P3, then earliest check-in first. */
  waitingCount: number;
  emergencyCount: number;
  isLoading: boolean;
  isMutating: boolean;
  isOffline: boolean;
  error: string;
  lastUpdatedAt: Date | null;
  refresh: () => void;
  /**
   * Applies a status transition and reloads the queue. Resolves `true` when the
   * backend accepted it, `false` when it failed (the error is already toasted),
   * so a caller that has side effects of its own - releasing a slot and
   * reloading the grid after a cancellation - can tell the two apart.
   */
  changeStatus: (ticketNumber: string, status: QueueStatus) => Promise<boolean>;
}

const PRIORITY_RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2 };

function sortTickets(tickets: QueueTicket[]): QueueTicket[] {
  return [...tickets].sort((a, b) => {
    const byPriority =
      (PRIORITY_RANK[a.priorityLevel] ?? 9) - (PRIORITY_RANK[b.priorityLevel] ?? 9);
    if (byPriority !== 0) return byPriority;
    return (a.checkInTime ?? "").localeCompare(b.checkInTime ?? "");
  });
}

function dedupe(tickets: QueueTicket[]): QueueTicket[] {
  const seen = new Map<string, QueueTicket>();
  for (const ticket of tickets) {
    if (!seen.has(ticket.ticketNumber)) seen.set(ticket.ticketNumber, ticket);
  }
  return sortTickets([...seen.values()]);
}

/**
 * Live waiting-room monitor for the whole clinic.
 *
 * Calls `GET /api/v1/queue/reception` once per department (the endpoint is
 * scoped by `departmentId`) in parallel, then merges and de-duplicates; the
 * panel's department tabs filter the merged list client-side. Re-polls every
 * 10 seconds. Falls back to a synthesized queue (flagged via `isOffline`) so
 * the desk keeps triaging while PatientIntakeService is down.
 *
 * `date` is the day the view is anchored at and `filter` picks the window: a
 * `TODAY`/`TOMORROW` view asks for that one day, while `UPCOMING` asks the
 * backend for everything from `date` onward - so a ticket booked for tomorrow
 * reaches the desk and the nurse station the moment either pill is pressed
 * rather than only when the date field on the intake form is moved.
 */
export function useReceptionQueue(
  date: string,
  filter: QueueDateFilter = "TODAY",
): ReceptionQueueState {
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  /** Day + window currently on screen, so a switch can be told from a poll. */
  const activeWindow = useRef("");

  useEffect(() => {
    if (!date) return undefined;

    // A day/window switch drops what is on screen first: otherwise the
    // previous day's list would sit under the newly pressed pill until the
    // response lands, which reads as the pill having done nothing.
    const windowKey = `${date}|${filter}`;
    if (activeWindow.current !== windowKey) {
      activeWindow.current = windowKey;
      setTickets([]);
      setIsLoading(true);
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const signal = controller.signal;

    async function load() {
      try {
        const results = await Promise.allSettled(
          RECEPTION_DEPARTMENTS.map((department) =>
            // The upcoming window is a single request rather than one call per
            // future day: the backend anchors it at `fromDate` and returns
            // everything active from there on.
            filter === "UPCOMING"
              ? getReceptionUpcomingQueue(department.id, date, signal)
              : getReceptionQueue(department.id, date, signal),
          ),
        );
        if (signal.aborted) return;

        const live = results
          .filter(
            (result): result is PromiseFulfilledResult<QueueTicket[]> =>
              result.status === "fulfilled",
          )
          .flatMap((result) => result.value);
        const failures = results.filter((result) => result.status === "rejected").length;

        if (live.length === 0 && failures > 0) {
          throw new Error("queue-unreachable");
        }

        setTickets(dedupe(live));
        setIsOffline(false);
        setError(
          failures > 0
            ? `${failures} khoa không phản hồi. Đang hiển thị dữ liệu một phần.`
            : "",
        );
        setLastUpdatedAt(new Date());
      } catch (cause) {
        if (signal.aborted) return;
        setTickets(
          dedupe(
            RECEPTION_DEPARTMENTS.flatMap((department) =>
              buildFallbackQueue(department.id, date),
            ),
          ),
        );
        setIsOffline(true);
        // Keep the reason visible: "backend is down" and "backend answered
        // with an error" need very different operator responses.
        setError(
          cause instanceof IntakeApiError
            ? cause.isOffline
              ? `${cause.message} Đang hiển thị hàng đợi mô phỏng.`
              : `${cause.message} Đang hiển thị hàng đợi mô phỏng cho tới khi dịch vụ hoạt động trở lại.`
            : "Không tải được hàng đợi. Đang hiển thị hàng đợi mô phỏng.",
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
  }, [date, filter, reloadToken]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  const changeStatus = useCallback(
    async (ticketNumber: string, status: QueueStatus): Promise<boolean> => {
      setIsMutating(true);
      try {
        await updateTicketStatus(ticketNumber, status);
        setReloadToken((token) => token + 1);
        return true;
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Không cập nhật được trạng thái phiếu.",
          { duration: 5000 },
        );
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [],
  );

  const waitingCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === "WAITING").length,
    [tickets],
  );
  const emergencyCount = useMemo(
    () => tickets.filter((ticket) => ticket.priorityLevel === "P1").length,
    [tickets],
  );

  return {
    tickets,
    waitingCount,
    emergencyCount,
    isLoading,
    isMutating,
    isOffline,
    error,
    lastUpdatedAt,
    refresh,
    changeStatus,
  };
}
