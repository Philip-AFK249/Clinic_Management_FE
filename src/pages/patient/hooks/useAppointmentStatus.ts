import { useCallback, useEffect, useRef, useState } from "react";
import {
  getActivePatientTicketApi,
  getTicketDetails,
  IntakeApiError,
  type QueueStatus,
  type QueueTicketDetailResponse,
} from "../../../services/intakeApi";

const POLL_INTERVAL_MS = 2_000;

/** States for which another answer can still change what the patient sees. */
const LIVE_STATUSES: readonly QueueStatus[] = ["PENDING_APPROVAL", "WAITING"];

interface UseAppointmentStatusOptions {
  /** PatientIntakeService's own Patient.id (never AuthService's users.id). */
  patientId?: number;
  ticketNumber: string;
  /** Check-in response status, so the pending card paints on the first frame. */
  initialStatus?: QueueStatus | null;
  enabled?: boolean;
}

export interface AppointmentStatusState {
  detail: QueueTicketDetailResponse | null;
  status: QueueStatus | null;
  isLoading: boolean;
  error: string;
  lastUpdatedAt: Date | null;
  refresh: () => void;
}

function networkMessage(cause: unknown): string {
  return cause instanceof IntakeApiError && cause.isOffline
    ? "Không kết nối được máy chủ. Đang thử lại tự động."
    : "Chưa đọc được trạng thái phiếu từ máy chủ. Vui lòng thử lại.";
}

/**
 * Poll the live status of a just-submitted online booking every two seconds.
 *
 * The patient endpoint is preferred because it survives a reload on another
 * device; the ticket-number endpoint is the fallback for a ticket the active
 * lookup no longer returns (e.g. one that has just been rejected). Polling
 * stops once the ticket reaches a terminal state - there is no point hammering
 * the service with a decision that cannot change.
 */
export function useAppointmentStatus({
  patientId,
  ticketNumber,
  initialStatus = null,
  enabled = true,
}: UseAppointmentStatusOptions): AppointmentStatusState {
  const [detail, setDetail] = useState<QueueTicketDetailResponse | null>(null);
  const [status, setStatus] = useState<QueueStatus | null>(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  /** Guards the interval against a second request after a terminal answer. */
  const stoppedRef = useRef(false);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    let stopped = false;
    let inFlight = false;
    stoppedRef.current = false;
    const interval = window.setInterval(() => void load(), POLL_INTERVAL_MS);

    async function load() {
      if (inFlight || stopped || stoppedRef.current) return;
      inFlight = true;
      try {
        let answer: QueueTicketDetailResponse | null = null;
        let lookupError: unknown = null;

        if (typeof patientId === "number") {
          try {
            answer = await getActivePatientTicketApi({ patientId }, controller.signal);
          } catch (cause) {
            if (controller.signal.aborted) throw cause;
            lookupError = cause;
          }
        }

        if (!answer && ticketNumber) {
          try {
            answer = await getTicketDetails(ticketNumber, controller.signal);
            lookupError = null;
          } catch (cause) {
            if (controller.signal.aborted) throw cause;
            lookupError = cause;
          }
        }

        if (stopped) return;
        if (answer) {
          setDetail(answer);
          setStatus(answer.status);
          setError("");
          setLastUpdatedAt(new Date());
          if (!LIVE_STATUSES.includes(answer.status)) {
            stoppedRef.current = true;
            window.clearInterval(interval);
          }
        } else {
          setError(networkMessage(lookupError));
        }
      } catch (cause) {
        if (stopped || controller.signal.aborted) return;
        setError(networkMessage(cause));
      } finally {
        inFlight = false;
        if (!stopped) setIsLoading(false);
      }
    }

    void load();
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [patientId, ticketNumber, reloadToken, enabled]);

  return { detail, status, isLoading, error, lastUpdatedAt, refresh };
}
