import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../context/useAuth";
import { departmentNameOf } from "../doctor/data/doctorDirectory";
import { nurseDepartmentName, resolveNurse } from "../reception/data/nurseDirectory";
import { useReceptionQueue } from "../reception/hooks/useReceptionQueue";
import { updateTicketStatus } from "../../services/intakeApi";
import type { QueueStatus, QueueTicket } from "../../services/intakeApi";
import { getShifts } from "../admin/services/scheduleApi";
import type { DoctorShift } from "../admin/services/scheduleApi";
import NurseStationHeader from "./components/NurseStationHeader";
import NurseQueuePanel from "./components/NurseQueuePanel";
import NurseDutyPanel from "./components/NurseDutyPanel";
import VitalsCaptureModal from "./components/VitalsCaptureModal";
import CompleteTicketDialog from "./components/CompleteTicketDialog";
import RestoreTicketDialog from "./components/RestoreTicketDialog";
import { useNurseHistoryQueue } from "./hooks/useNurseHistoryQueue";
import {
  hasRecordedVitals,
  sortNurseQueue,
  vitalsRecordFromTicket,
} from "./data/nurseStation";
import type { VitalsRecord } from "./data/nurseStation";
import { filterDateISO, todayISO } from "../reception/data/queueDates";
import type { QueueDateFilter } from "../reception/data/queueDates";

const ACTIVE_STATUSES: QueueStatus[] = ["WAITING", "CALLED", "IN_CONSULTATION"];

/**
 * Legacy `/nurse` station, now redirected to the unified exam room by `App`.
 * Kept only as a reference for the queue/duty data it used to render.
 */
export default function NurseStationPage() {
  const { user } = useAuth();
  const nurse = resolveNurse(user);

  const departmentId = user?.departmentId ?? nurse.departmentId;
  const departmentName =
    user?.departmentName ?? nurseDepartmentName(nurse) ?? departmentNameOf(departmentId);

  /**
   * The roster on the right is always today's - who is on duty *now* - while
   * the queue on the left follows whichever day the nurse has pinned, which is
   * the whole point of the Hôm nay / Ngày mai / Sắp tới pills: a ticket booked
   * for tomorrow has to be triageable before the patient arrives.
   */
  const date = todayISO();
  const [dateFilter, setDateFilter] = useState<QueueDateFilter>("TODAY");
  const queueDate = filterDateISO(dateFilter);
  const queue = useReceptionQueue(queueDate, dateFilter);
  const history = useNurseHistoryQueue(departmentId);

  const [shifts, setShifts] = useState<DoctorShift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [shiftsError, setShiftsError] = useState("");
  const [vitals, setVitals] = useState<Record<string, VitalsRecord>>({});
  const [activeTicket, setActiveTicket] = useState<QueueTicket | null>(null);
  const [completeTicket, setCompleteTicket] = useState<QueueTicket | null>(null);
  const [restoreTicket, setRestoreTicket] = useState<QueueTicket | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const shiftsSeq = useRef(0);
  const shiftsAbortRef = useRef<AbortController | null>(null);

  const loadShifts = useCallback(() => {
    shiftsAbortRef.current?.abort();
    const controller = new AbortController();
    shiftsAbortRef.current = controller;
    const seq = ++shiftsSeq.current;

    // State updates are queued in a microtask rather than run in the effect
    // body itself, matching DoctorRosterTab's loader (react-hooks rule).
    void Promise.resolve()
      .then(() => {
        if (seq !== shiftsSeq.current) return;
        setShiftsLoading(true);
        setShiftsError("");
      })
      .then(() => getShifts(departmentId, date, controller.signal))
      .then((list) => {
        if (seq !== shiftsSeq.current) return;
        setShifts(list);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || seq !== shiftsSeq.current) return;
        setShifts([]);
        setShiftsError(
          error instanceof Error
            ? error.message
            : "Không tải được ca trực hôm nay từ DoctorScheduleService.",
        );
      })
      .finally(() => {
        if (seq === shiftsSeq.current) setShiftsLoading(false);
      });
  }, [departmentId, date]);

  useEffect(() => {
    loadShifts();
    return () => {
      shiftsAbortRef.current?.abort();
    };
  }, [loadShifts]);

  const departmentTickets = useMemo(
    () =>
      sortNurseQueue(
        queue.tickets.filter((ticket) => ticket.departmentId === departmentId),
      ),
    [queue.tickets, departmentId],
  );

  const departmentHistory = useMemo(
    () =>
      departmentId > 0
        ? history.tickets.filter(
            (ticket) => ticket.departmentId === departmentId,
          )
        : history.tickets,
    [history.tickets, departmentId],
  );

  const waitingCount = useMemo(
    () => departmentTickets.filter((ticket) => ticket.status === "WAITING").length,
    [departmentTickets],
  );

  const emergencyCount = useMemo(
    () =>
      departmentTickets.filter(
        (ticket) =>
          ticket.priorityLevel === "P1" &&
          ACTIVE_STATUSES.includes(ticket.status),
      ).length,
    [departmentTickets],
  );

  /**
   * What the queue shows as "already measured": this session's own readings
   * first (they carry the nurse's name and time), then anything the ticket
   * already holds from an earlier shift or another station.
   */
  const effectiveVitals = useMemo(() => {
    const map: Record<string, VitalsRecord> = {};
    for (const ticket of departmentTickets) {
      const local = vitals[ticket.ticketNumber];
      if (local) {
        map[ticket.ticketNumber] = local;
        continue;
      }
      const saved = vitalsRecordFromTicket(ticket);
      if (saved) map[ticket.ticketNumber] = saved;
    }
    return map;
  }, [departmentTickets, vitals]);

  const measuredCount = useMemo(
    () => departmentTickets.filter((ticket) => effectiveVitals[ticket.ticketNumber]).length,
    [departmentTickets, effectiveVitals],
  );

  const completeHasVitals = completeTicket
    ? Boolean(vitals[completeTicket.ticketNumber]) ||
      hasRecordedVitals(completeTicket)
    : false;

  const handleRefresh = useCallback(() => {
    queue.refresh();
    history.refresh();
  }, [queue, history]);

  const handleStatusChange = useCallback(
    async (ticketNumber: string, status: QueueStatus) => {
      try {
        await updateTicketStatus(ticketNumber, status);
        queue.refresh();
        history.refresh();
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Không cập nhật được trạng thái phiếu.",
          { duration: 5000 },
        );
      }
    },
    [queue, history],
  );

  async function handleConfirmComplete() {
    if (!completeTicket) return;
    setIsCompleting(true);
    try {
      await updateTicketStatus(completeTicket.ticketNumber, "COMPLETED");
      toast.success(`Đã hoàn tất phiếu ${completeTicket.ticketNumber}.`, {
        duration: 4000,
      });
      setCompleteTicket(null);
      queue.refresh();
      history.refresh();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Không cập nhật được trạng thái phiếu.",
        { duration: 5000 },
      );
    } finally {
      setIsCompleting(false);
    }
  }

  function handleMeasureNow() {
    if (!completeTicket) return;
    setActiveTicket(completeTicket);
    setCompleteTicket(null);
  }

  async function handleConfirmRestore() {
    if (!restoreTicket) return;
    setIsRestoring(true);
    try {
      await updateTicketStatus(restoreTicket.ticketNumber, "WAITING");
      toast.success(
        `Đã khôi phục phiếu ${restoreTicket.ticketNumber} về hàng đợi.`,
        { duration: 4000 },
      );
      setRestoreTicket(null);
      queue.refresh();
      history.refresh();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Không khôi phục được phiếu.",
        { duration: 5000 },
      );
    } finally {
      setIsRestoring(false);
    }
  }

  /**
   * The reading is already on the ticket (the modal saved it); keep a local
   * copy for the nurse's name/time on the badge and re-pull the queue so the
   * card - and the doctor's EHR - reflects it without a reload.
   */
  function handleSaveVitals(record: VitalsRecord) {
    setVitals((current) => ({ ...current, [record.ticketNumber]: record }));
    setActiveTicket(null);
    queue.refresh();
    history.refresh();
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-light text-slate-900">
      <NurseStationHeader
        nurse={nurse}
        departmentName={departmentName}
        waitingCount={waitingCount}
        emergencyCount={emergencyCount}
        measuredCount={measuredCount}
        isOffline={queue.isOffline}
      />

      <div className="flex min-h-0 flex-1">
        {/* Left: the khoa's live queue */}
        <main className="flex w-[60%] min-w-0 flex-col overflow-hidden border-r border-slate-200/80">
          <NurseQueuePanel
            tickets={departmentTickets}
            historyTickets={departmentHistory}
            date={queueDate}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            waitingCount={waitingCount}
            emergencyCount={emergencyCount}
            vitals={effectiveVitals}
            isLoading={queue.isLoading}
            historyLoading={history.isLoading}
            isMutating={queue.isMutating || isCompleting || isRestoring}
            isOffline={queue.isOffline}
            error={queue.error}
            historyError={history.error}
            lastUpdatedAt={queue.lastUpdatedAt}
            onRefresh={handleRefresh}
            onChangeStatus={(ticketNumber, status) =>
              void handleStatusChange(ticketNumber, status)
            }
            onRequestComplete={setCompleteTicket}
            onRestoreTicket={setRestoreTicket}
            onCaptureVitals={setActiveTicket}
          />
        </main>

        {/* Right: today's doctor duty + nurse pairing */}
        <aside className="flex w-[40%] min-w-0 flex-col">
          <NurseDutyPanel
            shifts={shifts}
            isLoading={shiftsLoading}
            error={shiftsError}
            date={date}
            nurse={nurse}
            onRefresh={loadShifts}
          />
        </aside>
      </div>

      {completeTicket && (
        <CompleteTicketDialog
          ticket={completeTicket}
          hasVitals={completeHasVitals}
          isBusy={isCompleting}
          onClose={() => setCompleteTicket(null)}
          onMeasure={handleMeasureNow}
          onComplete={() => void handleConfirmComplete()}
        />
      )}

      {restoreTicket && (
        <RestoreTicketDialog
          ticket={restoreTicket}
          isBusy={isRestoring}
          onClose={() => setRestoreTicket(null)}
          onConfirm={() => void handleConfirmRestore()}
        />
      )}

      {activeTicket && (
        <VitalsCaptureModal
          ticket={activeTicket}
          existing={
            vitals[activeTicket.ticketNumber] ??
            vitalsRecordFromTicket(activeTicket)
          }
          nurseName={nurse.fullName}
          onClose={() => setActiveTicket(null)}
          onSave={handleSaveVitals}
        />
      )}
    </div>
  );
}
