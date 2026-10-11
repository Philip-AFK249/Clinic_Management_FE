import { useEffect, useMemo, useState } from "react";
import {
  getActivePatientTicket,
  getDoctorQueue,
  getTicketDetails,
  isNoActiveTicketError,
  isUnknownTicketError,
  isValidTicketNumber,
  patientsAhead,
  IntakeApiError,
} from "../../../services/intakeApi";
import type { QueueStatus, QueueTicket, QueueTicketDetailResponse } from "../../../services/intakeApi";
import { clearActiveBooking } from "../data/activeBooking";
import type { ActiveAppointment } from "../data/patientMockRecords";

const POLL_INTERVAL_MS = 10_000;

/** Still in a queue somewhere: worth re-checking every few seconds. */
const ACTIVE_STATUSES: readonly QueueStatus[] = ["WAITING", "CALLED", "IN_CONSULTATION"];

/** Visit is over: keep the last answer on screen, stop asking for a new one. */
const TERMINAL_STATUSES: readonly QueueStatus[] = ["COMPLETED", "CANCELLED", "SKIPPED"];

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
  /** False once the visit is finished (or cancelled) and no longer in a queue. */
  isActive: boolean;
  /**
   * The stored booking turned out to be unknown to the backend (legacy mock
   * such as `#APT-2026-8821`, or a purged record). It has been removed from
   * localStorage and polling has stopped - the dashboard should render its
   * empty state, silently.
   */
  invalidTicket: boolean;
  /** PatientIntakeService could not be reached or answered with a fault. */
  isOffline: boolean;
  error: string;
  lastUpdatedAt: Date | null;
}

/**
 * The signed-in patient's live ticket, polled every 10 seconds.
 *
 * Two lookups, in order of preference:
 *
 * 1. `GET /v1/queue/patient/{patientId}/active` - survives the browser losing
 *    the stored booking, and always reflects the newest active visit.
 * 2. `GET /v1/queue/tickets/{ticketNumber}` - for bookings stored before the
 *    backend stamped a `patientId`, and as the fallback when (1) says the
 *    patient has no active ticket: the stored number then reveals the final
 *    status (COMPLETED / CANCELLED) instead of blanking the screen.
 *
 * Lifecycle rules:
 *
 * - Poll only while the ticket is WAITING/CALLED/IN_CONSULTATION; once it is
 *   terminal, the last answer stays on screen and the interval stops.
 * - A number the backend does not know (HTTP 400/404 on the detail lookup) is
 *   not an error to keep retrying: the stored booking is purged, the poll
 *   stops, and the caller gets `invalidTicket` so the empty state can render
 *   without a single toast.
 * - Genuine offline/server faults keep the last known state and keep polling,
 *   because those usually recover on their own.
 */
export function usePatientTicket(booking: ActiveAppointment | null): PatientTicketState {
  const [detail, setDetail] = useState<QueueTicketDetailResponse | null>(null);
  const [queue, setQueue] = useState<QueueTicket[]>([]);
  const [isUnknownNumber, setIsUnknownNumber] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const ticketCode = booking?.ticketCode ?? null;
  const patientId = booking?.patientId ?? null;
  const doctorId = booking?.doctorId ?? null;
  // Judged from the booking alone, before any network call: a mock number such
  // as `#APT-2026-8821` must never reach the backend at all. Derived rather
  // than stored so the purge can happen in an effect without a cascading
  // setState (the storage reader normally rejects these already).
  const malformed = booking !== null && !isValidTicketNumber(booking.ticketCode);

  useEffect(() => {
    if (malformed) {
      // External system: an effect may update it synchronously.
      clearActiveBooking();
      return undefined;
    }
    if (!ticketCode) return undefined;
    const code: string = ticketCode;

    const controller = new AbortController();
    const { signal } = controller;
    let stopped = false;
    let intervalId = 0;

    function stopPolling() {
      stopped = true;
      if (intervalId !== 0) {
        window.clearInterval(intervalId);
        intervalId = 0;
      }
    }

    /** Drop a booking the backend has never heard of; no toast, no retry. */
    function purgeUnknownTicket() {
      stopPolling();
      clearActiveBooking();
      setIsUnknownNumber(true);
      setDetail(null);
      setQueue([]);
      setIsOffline(false);
      setError("");
    }

    async function load() {
      try {
        let next: QueueTicketDetailResponse | null = null;
        if (patientId !== null) {
          try {
            next = await getActivePatientTicket(patientId, signal);
          } catch (cause) {
            if (signal.aborted) return;
            // "No active ticket" is an ordinary answer (the visit finished),
            // not a fault - read the final state off the stored number instead.
            if (!isNoActiveTicketError(cause)) throw cause;
            next = null;
          }
        }
        if (next === null) {
          try {
            next = await getTicketDetails(code, signal);
          } catch (cause) {
            if (signal.aborted) return;
            if (!isUnknownTicketError(cause)) throw cause;
            // 400/404 here means the *number* is unknown (legacy mock or a
            // ticket deleted from the database) - not "visit finished".
            purgeUnknownTicket();
            return;
          }
        }
        if (signal.aborted) return;
        setDetail(next);
        setIsUnknownNumber(false);
        setIsOffline(false);
        setError("");

        const queueDoctorId = next.doctorId || doctorId;
        const stillQueued = ACTIVE_STATUSES.includes(next.status);
        if (queueDoctorId !== null && stillQueued) {
          const tickets = await getDoctorQueue(queueDoctorId, next.appointmentDate, signal);
          if (signal.aborted) return;
          setQueue(tickets);
        } else {
          setQueue([]);
        }
        setLastUpdatedAt(new Date());

        // Terminal: the screen keeps this final answer, the timer goes away.
        if (TERMINAL_STATUSES.includes(next.status)) stopPolling();
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
    intervalId = window.setInterval(() => {
      if (!stopped) void load();
    }, POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      if (intervalId !== 0) window.clearInterval(intervalId);
    };
  }, [ticketCode, patientId, doctorId, malformed]);

  const status: QueueStatus = detail?.status ?? booking?.status ?? "WAITING";
  const isActive = ACTIVE_STATUSES.includes(status);
  const yourTurn = status === "CALLED" || status === "IN_CONSULTATION";

  const mine = detail
    ? queue.find((ticket) => ticket.ticketNumber === detail.ticketNumber)
    : undefined;

  const personsAhead = useMemo(() => {
    if (!mine || !isActive) return null;
    return patientsAhead(mine, queue);
  }, [mine, isActive, queue]);

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
    invalidTicket: malformed || isUnknownNumber,
    isOffline,
    error,
    lastUpdatedAt,
  };
}
