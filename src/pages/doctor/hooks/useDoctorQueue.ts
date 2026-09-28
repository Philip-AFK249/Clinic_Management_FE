import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  callNextPatient,
  getDoctorQueue,
  updateTicketStatus,
} from "../../../services/intakeApi";
import { IntakeApiError } from "../../../services/intakeApi";
import type { QueueTicket } from "../../../services/intakeApi";
import { ACTIVE_PATIENT, QUEUE_PATIENTS } from "../data/doctorMockData";
import type { PatientRecord } from "../data/doctorMockData";
import { ticketToPatientRecord } from "../data/ticketMapper";

/**
 * The doctor session in DoctorHeader is
 * "BS. CKI. Lê Thị Hoàng Yến - Phòng 201 - Khoa Hô hấp & Dị ứng",
 * which is doctor id 4 in the DoctorScheduleService seed data.
 */
export const DOCTOR_SESSION_ID = 4;

const POLL_INTERVAL_MS = 8_000;

export type QueueSource = "live" | "mock";

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

export function useDoctorQueue(doctorId: number = DOCTOR_SESSION_ID) {
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
        const tickets: QueueTicket[] = await getDoctorQueue(
          doctorId,
          undefined,
          controller.signal,
        );
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
  }, [doctorId, isTabVisible, reloadToken]);

  /** Promote the head of the waiting list into the consultation room. */
  const callNext = useCallback(async () => {
    setIsCalling(true);
    try {
      const ticket = await callNextPatient(doctorId);
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
  }, [doctorId, refresh]);

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
