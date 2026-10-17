import { useCallback, useEffect, useMemo, useState } from "react";
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
  writeActiveBooking,
} from "../data/activeBooking";
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
  /**
   * Drop whatever is on screen for the current poll cycle and ask again right
   * away. Used after a cancellation: the stored booking is gone and the
   * dashboard must not wait for the 10-second interval to agree.
   */
  refresh: () => void;
}

/**
 * The signed-in patient's live ticket, polled every 10 seconds.
 *
 * Resolution order, because "the patient has no appointment" must never be
 * reached while a real ticket exists:
 *
 * 1. `GET /v1/queue/patient/{patientId}/active` - the intake `Patient.id`
 *    stamped on the booking confirmation. Exact, and immune to how a phone or
 *    BHYT number happens to be formatted.
 * 2. `GET /v1/queue/patient/active?identifier=...` - every candidate spelling
 *    of the account's phone, BHYT and CCCD (plus the phone recorded on the
 *    stored booking), tried in turn. One badly formatted field must not hide a
 *    ticket the others can find.
 * 3. `GET /v1/queue/tickets/{ticketNumber}` - the stored booking's number,
 *    which reveals the final status of a finished visit (and is the only path
 *    left when the account carries no identifier at all).
 *
 * A blank answer (204 No Content, or a 400 from an older build) resolves to
 * `null` inside `getActivePatientTicketApi` and falls through to the next
 * lookup rather than blanking the screen. Every answer that does find a ticket
 * is written back into the booking cache, so the card keeps rendering after a
 * reload - or from another device - even when localStorage never saw the
 * booking flow.
 *
 * Lifecycle rules:
 *
 * - Poll only while the ticket is WAITING/CALLED/IN_CONSULTATION; once it is
 *   terminal, the last answer stays on screen and the interval stops.
 * - A number the backend does not know (HTTP 400/404 on the detail lookup) is
 *   not an error to keep retrying: the stored booking is purged, the poll
 *   stops, and the caller gets `invalidTicket` so the empty state can render
 *   without a single toast.
 * - No candidates and no stored number is skipped entirely, and a genuine
 *   offline/server fault keeps the last known state and keeps polling, because
 *   those usually recover on their own.
 */
export function usePatientTicket(
  booking: ActiveAppointment | null,
  identifiers: string[],
  ownerEmail: string | null,
): PatientTicketState {
  const [detail, setDetail] = useState<QueueTicketDetailResponse | null>(null);
  const [queue, setQueue] = useState<QueueTicket[]>([]);
  const [isUnknownNumber, setIsUnknownNumber] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

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
  // Judged from the booking alone, before any network call: a mock number such
  // as `#APT-2026-8821` must never reach the backend at all. Derived rather
  // than stored so the purge can happen in an effect without a cascading
  // setState (the storage reader normally rejects these already).
  const malformed = booking !== null && !isValidTicketNumber(booking.ticketCode);

  useEffect(() => {
    if (malformed) {
      // External system: an effect may update it synchronously.
      clearActiveBooking(ownerEmail);
      return undefined;
    }
    // Nothing to ask about: no verified stored ticket, no intake patient id and
    // no identifier to query the intake service with.
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

    async function load() {
      try {
        let next: QueueTicketDetailResponse | null = null;

        // 1. The intake patient id is exact; ask it first when the booking
        //    carried one from the check-in response.
        if (patientId !== null) {
          next = await getActivePatientTicketApi({ patientId }, signal);
          if (signal.aborted) return;
        }

        // 2. Every identifier spelling in turn - a phone stored with a country
        //    code, or a BHYT number typed with spaces, must not hide a ticket
        //    the other fields can find.
        for (const identifier of candidates) {
          if (next !== null) break;
          next = await getActivePatientTicketApi({ identifier }, signal);
          if (signal.aborted) return;
        }

        // 3. The stored ticket number, which also covers a visit that already
        //    finished (its final status is worth showing, not a blank screen).
        if (next === null && code !== null) {
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
        if (next === null) {
          // Nothing active, and no stored number to fall back on: the patient
          // simply has no appointment.
          setDetail(null);
          setQueue([]);
          setLastUpdatedAt(new Date());
          stopPolling();
          return;
        }
        setDetail(next);
        setIsUnknownNumber(false);
        setIsOffline(false);
        setError("");

        // The backend's copy wins over whatever this browser had cached - a
        // ticket booked elsewhere, or one whose cache did not survive a
        // logout. Only written when it actually differs, so the 10-second poll
        // does not rewrite localStorage every cycle.
        if (ownerEmail && cachedTicketCode !== next.ticketNumber) {
          writeActiveBooking(appointmentFromTicketDetail(next), ownerEmail);
        }

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
  }, [
    ticketCode,
    patientId,
    trimmedIdentifierKey,
    doctorId,
    ownerEmail,
    malformed,
    cachedTicketCode,
    reloadToken,
  ]);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

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
    refresh,
  };
}
