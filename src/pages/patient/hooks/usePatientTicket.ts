import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getActivePatientTicketApi,
  getDoctorQueue,
  getTicketDetails,
  isUnknownTicketError,
  isValidTicketNumber,
  patientsAhead,
  IntakeApiError,
} from "../../../services/intakeApi";
import type { QueueStatus, QueueTicket, QueueTicketDetailResponse } from "../../../services/intakeApi";
import {
  appointmentFromTicketDetail,
  clearActiveBooking,
  isAppointmentDateExpired,
  syncActiveBooking,
  writeActiveBooking,
} from "../data/activeBooking";
import type { ActiveAppointment } from "../data/patientMockRecords";
import {
  isQueuedStatus,
  isTemporaryStatus,
  isTerminalStatus,
  notifyTicketAccepted,
  notifyTicketRejected,
} from "../data/ticketLifecycle";

/** Temporary tickets must be checked far more often than a normal queue. */
const TEMPORARY_POLL_INTERVAL_MS = 3_000;
const ACTIVE_POLL_INTERVAL_MS = 10_000;

export interface PatientTicketState {
  /** The backend's view of the ticket; `null` until the first poll lands. */
  detail: QueueTicketDetailResponse | null;
  /** Live status, seeded from the stored booking until the service answers. */
  status: QueueStatus;
  /** That doctor's active queue on the booked date, ours included. */
  queue: QueueTicket[];
  /** People still ahead of this ticket, or `null` while it cannot be told. */
  personsAhead: number | null;
  /** Ticket number currently with the doctor, if any. */
  currentServing: string | null;
  /** True once this ticket itself is CALLED or IN_CONSULTATION. */
  yourTurn: boolean;
  /** Temporary holds count as active, but they are not in a doctor's queue. */
  isActive: boolean;
  /** True only once the ticket has entered the real waiting queue. */
  isInQueue: boolean;
  /**
   * The stored booking must not be shown: the backend rejected the number,
   * answered "nothing active", or the hold was rejected/expired/cancelled.
   * Storage has been purged in every one of those cases.
   */
  invalidTicket: boolean;
  /** PatientIntakeService could not be reached or answered with a fault. */
  isOffline: boolean;
  error: string;
  lastUpdatedAt: Date | null;
  /**
   * Drop whatever is on screen for the current poll cycle and ask again right
   * away. Used after a cancellation or a manual refresh.
   */
  refresh: () => void;
}

/**
 * The signed-in patient's live ticket.
 *
 * Resolution order, because "the patient has no appointment" must never be
 * reached while a real ticket exists:
 *
 * 1. `GET /v1/queue/patient/{patientId}/active` - the intake `Patient.id`
 *    stamped on the booking confirmation.
 * 2. `GET /v1/queue/patient/active?identifier=...` - every candidate spelling
 *    of the account's phone, BHYT and CCCD (plus the stored booking's phone).
 * 3. `GET /v1/queue/tickets/{ticketNumber}` - the stored booking's number,
 *    which also reveals the final status of a finished/rejected visit.
 *
 * While the ticket is `PENDING_CONFIRMATION` the poll runs every 3 seconds so
 * an admin decision reaches the patient promptly; once the ticket is official
 * it drops back to 10 seconds, and it stops entirely for terminal statuses.
 *
 * Terminal online-ticket transitions are handled here rather than in a card:
 * acceptance toasts once and keeps the official ticket on screen, rejection
 * toasts once, activates the caller's re-booking cooldown, purges localStorage
 * and tells the caller to drop its state.
 */
export function usePatientTicket(
  booking: ActiveAppointment | null,
  identifiers: string[],
  ownerEmail: string | null,
  onRejected?: (detail: QueueTicketDetailResponse) => void,
): PatientTicketState {
  const [detail, setDetail] = useState<QueueTicketDetailResponse | null>(null);
  const [queue, setQueue] = useState<QueueTicket[]>([]);
  const [isUnknownNumber, setIsUnknownNumber] = useState(false);
  const [staleBooking, setStaleBooking] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const seenStatusRef = useRef<QueueStatus | null>(booking?.status ?? null);
  /** Set on a terminal answer so an effect restart cannot re-poll it. */
  const haltedRef = useRef(false);
  const onRejectedRef = useRef(onRejected);

  useEffect(() => {
    onRejectedRef.current = onRejected;
  }, [onRejected]);

  // Stable identity is the caller's job (useMemo around `identifierCandidates`),
  // so the effect below can list it as a dependency without looping.
  const trimmedIdentifiers = useMemo(
    () => [...new Set(identifiers.map((value) => value.trim()).filter(Boolean))],
    [identifiers],
  );

  const ticketCode = booking?.ticketCode ?? null;
  const patientId = booking?.patientId ?? null;
  const doctorId = booking?.doctorId ?? null;
  const cachedTicketCode = ticketCode;
  const trimmedIdentifierKey = trimmedIdentifiers.join("|");
  const malformed = booking !== null && !isValidTicketNumber(booking.ticketCode);
  // Temporary holds are polled three times as often as an ordinary visit. It
  // is derived from the freshest answer rather than stored in another state,
  // so a status change reschedules the interval without a setState-in-effect.
  const pollingMode: "temporary" | "standard" = detail
    ? isTemporaryStatus(detail.status)
      ? "temporary"
      : "standard"
    : isTemporaryStatus(booking?.status)
      ? "temporary"
      : "standard";

  useEffect(() => {
    // A different ticket starts a fresh lifecycle, including its own toasts.
    seenStatusRef.current = booking?.status ?? null;
    haltedRef.current = false;
    // Status changes of the *same* ticket are handled inside `load`, not here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketCode]);

  useEffect(() => {
    if (malformed) {
      clearActiveBooking(ownerEmail);
      return undefined;
    }
    if (haltedRef.current) return undefined;
    if (!ticketCode && patientId === null && trimmedIdentifierKey === "") {
      return undefined;
    }
    const code: string | null = ticketCode;
    const candidates: string[] =
      trimmedIdentifierKey === "" ? [] : trimmedIdentifierKey.split("|");

    const controller = new AbortController();
    const { signal } = controller;
    let stopped = false;
    let intervalId = 0;

    function stopPolling() {
      stopped = true;
      haltedRef.current = true;
      if (intervalId !== 0) {
        window.clearInterval(intervalId);
        intervalId = 0;
      }
    }

    /** Drop a booking the backend has never heard of; no toast, no retry. */
    function purgeUnknownTicket() {
      stopPolling();
      clearActiveBooking(ownerEmail);
      setIsUnknownNumber(true);
      setDetail(null);
      setQueue([]);
      setIsOffline(false);
      setError("");
    }

    /** Rejection and cancellation both remove the temporary ticket. */
    function removeActiveTicket() {
      stopPolling();
      clearActiveBooking(ownerEmail);
      setDetail(null);
      setQueue([]);
      setStaleBooking(true);
      setIsOffline(false);
      setError("");
      setLastUpdatedAt(new Date());
    }

    async function load() {
      try {
        let next: QueueTicketDetailResponse | null = null;
        let cachePurgedThisCycle = false;
        let unknownTicketNumber = false;
        // While a ticket is temporary, watch the ticket itself: that endpoint
        // is the one that reports the admin's approve/reject decision and the
        // exact hold deadline. Once official, the active-ticket lookups below
        // are enough and cheaper.
        const preferTicketDetails =
          code !== null &&
          isTemporaryStatus(detail?.status ?? booking?.status ?? null);

        /** The local mirror is wrong: drop it and stop claiming a booking. */
        function purgeStaleBooking() {
          clearActiveBooking(ownerEmail);
          cachePurgedThisCycle = true;
          setDetail(null);
          setQueue([]);
          setStaleBooking(true);
          setLastUpdatedAt(new Date());
          stopPolling();
        }

        if (preferTicketDetails && code !== null) {
          try {
            next = await getTicketDetails(code, signal);
          } catch (cause) {
            if (signal.aborted) return;
            if (!isUnknownTicketError(cause)) throw cause;
            unknownTicketNumber = true;
          }
        }

        if (next === null && patientId !== null) {
          next = await getActivePatientTicketApi({ patientId }, signal);
          if (signal.aborted) return;
          if (next === null) {
            clearActiveBooking(ownerEmail);
            cachePurgedThisCycle = true;
            setStaleBooking(true);
          }
        }

        for (const identifier of candidates) {
          if (next !== null) break;
          next = await getActivePatientTicketApi({ identifier }, signal);
          if (signal.aborted) return;
        }

        if (next === null && code !== null && !preferTicketDetails) {
          try {
            next = await getTicketDetails(code, signal);
          } catch (cause) {
            if (signal.aborted) return;
            if (!isUnknownTicketError(cause)) throw cause;
            unknownTicketNumber = true;
          }
        }
        if (signal.aborted) return;
        if (next === null && unknownTicketNumber) {
          purgeUnknownTicket();
          return;
        }
        if (next === null) {
          purgeStaleBooking();
          return;
        }
        if (isAppointmentDateExpired(next.appointmentDate)) {
          purgeStaleBooking();
          return;
        }

        const previousStatus = seenStatusRef.current;

        if (previousStatus !== next.status) {
          if (
            previousStatus === "PENDING_CONFIRMATION" &&
            next.status === "WAITING"
          ) {
            notifyTicketAccepted(next.ticketNumber);
          }
          if (next.status === "REJECTED") {
            notifyTicketRejected(next.ticketNumber, next.rejectionReason);
          }
        }
        seenStatusRef.current = next.status;

        // Rejected, cancelled and skipped tickets leave no active booking at
        // all: a skipped temporary hold has lost its claim to the slot too.
        if (
          next.status === "REJECTED" ||
          next.status === "CANCELLED" ||
          next.status === "SKIPPED"
        ) {
          if (next.status === "REJECTED") {
            onRejectedRef.current?.(next);
          }
          removeActiveTicket();
          return;
        }

        setDetail(next);
        setIsUnknownNumber(false);
        setStaleBooking(false);
        setIsOffline(false);
        setError("");

        // The backend's copy wins over the browser cache, including the exact
        // hold deadline and the confirmation stamp written by the admin.
        if (ownerEmail && (cachePurgedThisCycle || cachedTicketCode !== next.ticketNumber)) {
          writeActiveBooking(appointmentFromTicketDetail(next), ownerEmail);
        } else if (ownerEmail) {
          syncActiveBooking(next, ownerEmail);
        }

        const queueDoctorId = next.doctorId || doctorId;
        const stillQueued = isQueuedStatus(next.status);
        if (queueDoctorId !== null && stillQueued) {
          const tickets = await getDoctorQueue(queueDoctorId, next.appointmentDate, signal);
          if (signal.aborted) return;
          setQueue(tickets);
        } else {
          setQueue([]);
        }
        setLastUpdatedAt(new Date());

        // The interval is derived from `detail`; terminal answers stop it here.
        if (isTerminalStatus(next.status)) stopPolling();
      } catch (cause) {
        if (signal.aborted) return;
        setIsOffline(true);
        setError(
          cause instanceof IntakeApiError
            ? cause.message
            : "Không tải được trạng thái phiếu khám. Vui lòng thử lại.",
        );
      }
    }

    void load();
    intervalId = window.setInterval(
      () => {
        if (!stopped) void load();
      },
      pollingMode === "temporary"
        ? TEMPORARY_POLL_INTERVAL_MS
        : ACTIVE_POLL_INTERVAL_MS,
    );
    return () => {
      controller.abort();
      if (intervalId !== 0) window.clearInterval(intervalId);
    };
  }, [
    ticketCode,
    patientId,
    trimmedIdentifierKey,
    doctorId,
    ownerEmail,
    malformed,
    cachedTicketCode,
    reloadToken,
    pollingMode,
    booking?.status,
    detail?.status,
  ]);

  const refresh = useCallback(() => {
    haltedRef.current = false;
    setReloadToken((token) => token + 1);
  }, []);

  const status: QueueStatus = detail?.status ?? booking?.status ?? "WAITING";
  const isInQueue = isQueuedStatus(status);
  const isActive = isTemporaryStatus(status) || isInQueue;
  const yourTurn = status === "CALLED" || status === "IN_CONSULTATION";

  const mine = detail
    ? queue.find((ticket) => ticket.ticketNumber === detail.ticketNumber)
    : undefined;

  const personsAhead = useMemo(() => {
    if (!mine || !isInQueue) return null;
    return patientsAhead(mine, queue);
  }, [mine, isInQueue, queue]);

  const currentServing =
    queue.find((ticket) => ticket.status === "CALLED" || ticket.status === "IN_CONSULTATION")
      ?.ticketNumber ?? null;

  return {
    detail,
    status,
    queue,
    personsAhead,
    currentServing,
    yourTurn,
    isActive,
    isInQueue,
    invalidTicket: malformed || isUnknownNumber || staleBooking,
    isOffline,
    error,
    lastUpdatedAt,
    refresh,
  };
}
