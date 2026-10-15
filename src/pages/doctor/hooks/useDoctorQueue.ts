import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  callNextPatient,
  getDoctorQueue,
  getDoctorUpcomingQueue,
  updateTicketStatus,
} from "../../../services/intakeApi";
import { IntakeApiError } from "../../../services/intakeApi";
import type { QueueTicket } from "../../../services/intakeApi";
import { ACTIVE_PATIENT, QUEUE_PATIENTS } from "../data/doctorMockData";
import type { PatientRecord } from "../data/doctorMockData";
import { useDoctorSession } from "./useDoctorSession";
import { ticketToPatientRecord } from "../data/ticketMapper";

const POLL_INTERVAL_MS = 8_000;

export type QueueSource = "live" | "mock";

/**
 * What the queue list is scoped to.
 *
 * - `date`: one day via `GET /queue/doctor/{id}?date=YYYY-MM-DD` (defaults to
 *   today), so tickets booked for tomorrow appear as soon as the doctor
 *   switches the date selector to tomorrow.
 * - `upcoming`: `GET /queue/doctor/{id}/upcoming` - every waiting ticket from
 *   today onward, so a pre-booked tomorrow ticket is never missed.
 */
export type DoctorQueueView = "date" | "upcoming";

/**
 * `YYYY-MM-DD` in the browser's local offset, shifted by `dayOffset` days
 * (negative = past). The offset correction mirrors BookingPage's `todayIso`:
 * `toISOString()` alone reports UTC, which reads as "yesterday" during the
 * first hours of the day in Asia/Ho_Chi_Minh.
 */
export function dayOffsetIso(dayOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** Today in local time - the date the queue defaults to. */
export function todayIso(): string {
  return dayOffsetIso(0);
}

/**
 * The doctor workspace is a long-lived single-page screen. Once the tab is
 * backgrounded the poll interval is torn down entirely - browsers throttle
 * timers in hidden tabs, which turns a dormant tab into a burst of catch-up
 * requests on wake - and a single immediate fetch runs the moment the tab
 * becomes visible again.
 */
function tabIsVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function sortByPriority(queue: PatientRecord[]): PatientRecord[] {
  return [...queue].sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * `doctorIdOverride` exists for tests and for screens that deliberately pin a
 * roster row; the EHR itself always follows the signed-in account so the queue
 * can never be scoped to a different doctor than the one in the header.
 *
 * `targetDate` (`YYYY-MM-DD`) picks which day's queue is polled; it defaults
 * to today and re-fetches whenever it changes, which is what makes a ticket
 * booked for tomorrow (e.g. #C-001 on 16/10/2026) appear the moment the
 * doctor selects tomorrow. `view` switches between that per-day fetch and the
 * `upcoming` window described on `DoctorQueueView`.
 */
export function useDoctorQueue(
  doctorIdOverride?: number,
  targetDate?: string,
  view: DoctorQueueView = "date",
) {
  const { doctorId: sessionDoctorId } = useDoctorSession();
  const doctorId = doctorIdOverride ?? sessionDoctorId;
  const date = targetDate ?? todayIso();

  const [activePatient, setActivePatient] = useState<PatientRecord | null>(
    ACTIVE_PATIENT,
  );
  const [queue, setQueue] = useState<PatientRecord[]>(() =>
    sortByPriority(QUEUE_PATIENTS),
  );
  const [finishedEncounters, setFinishedEncounters] = useState<string[]>([]);
  const [source, setSource] = useState<QueueSource>("mock");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(tabIsVisible);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const activeTicketRef = useRef<string | null>(ACTIVE_PATIENT.ticketNumber);
  const hasLoadedLive = useRef(false);
  const hasWarnedOffline = useRef(false);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  // Returning to the tab means the queue has almost certainly moved on, so
  // fetch immediately instead of waiting out the rest of the poll interval.
  useEffect(() => {
    function onVisibilityChange() {
      const visible = tabIsVisible();
      setIsTabVisible(visible);
      if (visible) refresh();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refresh]);

  useEffect(() => {
    // Hidden tab: no interval, no requests. Becoming visible re-runs this
    // effect, which performs the single catch-up fetch.
    if (!isTabVisible) return undefined;

    let cancelled = false;
    const controller = new AbortController();

    async function load(showSpinner: boolean) {
      if (showSpinner) setIsRefreshing(true);
      try {
        // Per-day fetch carries the selected date so tomorrow's bookings show
        // under "Ngày mai"; the upcoming window is dateless on the backend.
        const tickets: QueueTicket[] =
          view === "upcoming"
            ? await getDoctorUpcomingQueue(doctorId, controller.signal)
            : await getDoctorQueue(doctorId, date, controller.signal);
        if (cancelled) return;

        const records = tickets.map(ticketToPatientRecord);
        setQueue(
          sortByPriority(
            records.filter(
              (record) => record.ticketNumber !== activeTicketRef.current,
            ),
          ),
        );
        setSource("live");
        setLastUpdatedAt(new Date());

        if (!hasLoadedLive.current) {
          // First real response: discard the seeded demo patient so the
          // consultation room reflects the actual queue, not mock data.
          hasLoadedLive.current = true;
          const called = tickets.find((ticket) => ticket.status === "CALLED");
          activeTicketRef.current = called?.ticketNumber ?? null;
          setActivePatient(called ? ticketToPatientRecord(called) : null);
        } else if (!activeTicketRef.current) {
          // Adopt a patient who was called in from another station.
          const called = tickets.find((ticket) => ticket.status === "CALLED");
          if (called) {
            const record = ticketToPatientRecord(called);
            activeTicketRef.current = record.ticketNumber;
            setActivePatient(record);
          }
        }
      } catch (cause) {
        if (cancelled) return;
        // Keep the previous list (live or seeded) so the EHR stays usable.
        if (!hasWarnedOffline.current) {
          hasWarnedOffline.current = true;
          const detail =
            cause instanceof IntakeApiError ? cause.message : "Lỗi không xác định.";
          toast.info(
            `${detail} Đang hiển thị dữ liệu mô phỏng cho hàng đợi.`,
            { duration: 6000 },
          );
        }
        setSource("mock");
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    }

    void load(true);
    const interval = window.setInterval(() => void load(false), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [date, doctorId, isTabVisible, reloadToken, view]);

  /** Promote the head of the waiting list into the consultation room. */
  const callNext = useCallback(async () => {
    setIsCalling(true);
    try {
      // The upcoming window is anchored at today on the backend, so only the
      // per-day view pins an explicit `date` onto the call.
      const ticket = await callNextPatient(
        doctorId,
        view === "date" ? date : undefined,
      );
      const record = ticketToPatientRecord(ticket);
      activeTicketRef.current = record.ticketNumber;
      setActivePatient(record);
      toast.success(`Đã gọi bệnh nhân ${record.name} (${record.ticketNumber}) vào phòng.`, {
        duration: 4000,
      });
      refresh();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không gọi được bệnh nhân tiếp theo.",
        { duration: 5000 },
      );
    } finally {
      setIsCalling(false);
    }
  }, [date, doctorId, refresh, view]);

  const skipPatient = useCallback(
    async (ticketNumber: string) => {
      try {
        await updateTicketStatus(ticketNumber, "SKIPPED");
        const target = queue.find((patient) => patient.ticketNumber === ticketNumber);
        toast.info(
          `Đã bỏ qua phiếu ${ticketNumber}${target ? ` (${target.name})` : ""}. Bệnh nhân sẽ được gọi lại vòng sau.`,
        );
        refresh();
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Không bỏ qua được phiếu khám.",
          { duration: 5000 },
        );
      }
    },
    [queue, refresh],
  );

  const finishEncounter = useCallback(
    (encounterId: string) => {
      const ticketNumber = activeTicketRef.current;
      activeTicketRef.current = null;
      setActivePatient(null);
      setFinishedEncounters((prev) => [...prev, encounterId]);

      if (ticketNumber && source === "live") {
        void updateTicketStatus(ticketNumber, "COMPLETED")
          .then(refresh)
          .catch((cause: unknown) => {
            toast.error(
              cause instanceof Error
                ? cause.message
                : "Không cập nhật được trạng thái hoàn tất của phiếu.",
            );
          });
      }
    },
    [refresh, source],
  );

  const waitingCount = queue.length;
  const emergencyCount = queue.filter((p) => p.triage === "P1").length;

  return {
    /** The doctor every request in this hook is scoped to. */
    doctorId,
    activePatient,
    queue,
    waitingCount,
    emergencyCount,
    finishedEncounters,
    source,
    isRefreshing,
    isCalling,
    /** False while the tab is hidden, i.e. polling is suspended. */
    isTabVisible,
    lastUpdatedAt,
    refresh,
    callNext,
    skipPatient,
    finishEncounter,
  };
}
