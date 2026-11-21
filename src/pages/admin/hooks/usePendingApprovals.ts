import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  approveTicketApi,
  getPendingApprovalTicketsApi,
  rejectTicketApi,
  type PendingApprovalTicket,
} from "../../../services/intakeApi";

const POLL_INTERVAL_MS = 3_000;

type ApprovalAction = "APPROVE" | "REJECT";

/**
 * Live approval board shared by the Admin dashboard and the Reception desk.
 *
 * The endpoint is polled every three seconds rather than on focus alone: a
 * transfer can be confirmed while staff are looking at another screen, and a
 * stale row would tempt them to approve a ticket twice. Successful decisions
 * remove the row locally at once and ask the caller (via `onChanged`) to
 * refresh any queue/slot panels the transition affects.
 */
export function usePendingApprovals(onChanged?: () => void) {
  const [tickets, setTickets] = useState<PendingApprovalTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState<Record<string, ApprovalAction>>({});
  const [reloadToken, setReloadToken] = useState(0);
  const onChangedRef = useRef(onChanged);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    let inFlight = false;

    async function load() {
      if (inFlight || stopped) return;
      inFlight = true;
      try {
        const rows = await getPendingApprovalTicketsApi(controller.signal);
        if (stopped) return;
        setTickets(rows);
        setError("");
        setLastUpdatedAt(new Date());
      } catch (cause) {
        if (stopped || controller.signal.aborted) return;
        // A failed refresh keeps the last known rows on screen; silently
        // replacing them with an empty board would hide pending payments.
        setError(
          cause instanceof Error
            ? cause.message
            : "Không tải được danh sách phiếu chờ duyệt. Đang thử lại tự động.",
        );
      } finally {
        inFlight = false;
        if (!stopped) setIsLoading(false);
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [reloadToken]);

  const decide = useCallback(async (ticket: PendingApprovalTicket, action: ApprovalAction) => {
    const number = ticket.ticketNumber;
    setBusy((current) => ({ ...current, [number]: action }));
    try {
      if (action === "APPROVE") {
        await approveTicketApi(number);
        toast.success("Appointment approved successfully", { duration: 5000 });
      } else {
        await rejectTicketApi(number);
        toast.success("Appointment rejected. Slot released.", { duration: 5000 });
      }
      // Remove the decided row immediately; the next 3-second poll confirms
      // the backend's own view without making staff wait for it.
      setTickets((current) => current.filter((row) => row.ticketNumber !== number));
      onChangedRef.current?.();
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Vui lòng thử lại.";
      toast.error(
        action === "APPROVE"
          ? "Could not approve appointment. Please try again."
          : "Could not reject appointment. Please try again.",
        { description: message, duration: 7000 },
      );
      return false;
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[number];
        return next;
      });
    }
  }, []);

  const approve = useCallback(
    (ticket: PendingApprovalTicket) => decide(ticket, "APPROVE"),
    [decide],
  );
  const reject = useCallback(
    (ticket: PendingApprovalTicket) => decide(ticket, "REJECT"),
    [decide],
  );
  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    tickets,
    isLoading,
    error,
    lastUpdatedAt,
    busy,
    approve,
    reject,
    refresh,
    isActing: (ticketNumber: string) => Boolean(busy[ticketNumber]),
  };
}
