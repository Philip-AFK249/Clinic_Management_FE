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
import { sortNurseQueue, vitalsRecordFromTicket } from "./data/nurseStation";
import type { VitalsRecord } from "./data/nurseStation";
import { filterDateISO, todayISO } from "../reception/data/queueDates";
import type { QueueDateFilter } from "../reception/data/queueDates";

const ACTIVE_STATUSES: QueueStatus[] = ["WAITING", "CALLED", "IN_CONSULTATION"];

/**
 * `/nurse` - the điều dưỡng station.
 *
 * Three things a triage nurse needs on one screen: their khoa's live queue
 * (PatientIntakeService), today's doctor duty roster with the pairing written
 * by the admin console (DoctorScheduleService), and bedside vitals capture.
 * The queue is scoped to the signed-in nurse's department; everything else on
 * the screen is clinic-wide by design (who is on, who is paired with whom).
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

  const [shifts, setShifts] = useState<DoctorShift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [shiftsError, setShiftsError] = useState("");
  const [vitals, setVitals] = useState<Record<string, VitalsRecord>>({});
  const [activeTicket, setActiveTicket] = useState<QueueTicket | null>(null);

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

  const handleStatusChange = useCallback(
    async (ticketNumber: string, status: QueueStatus) => {
      try {
        await updateTicketStatus(ticketNumber, status);
        queue.refresh();
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Không cập nhật được trạng thái phiếu.",
          { duration: 5000 },
        );
      }
    },
    [queue],
  );

  /**
   * The reading is already on the ticket (the modal saved it); keep a local
   * copy for the nurse's name/time on the badge and re-pull the queue so the
   * card - and the doctor's EHR - reflects it without a reload.
   */
  function handleSaveVitals(record: VitalsRecord) {
    setVitals((current) => ({ ...current, [record.ticketNumber]: record }));
    setActiveTicket(null);
    queue.refresh();
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
            date={queueDate}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            waitingCount={waitingCount}
            emergencyCount={emergencyCount}
            vitals={effectiveVitals}
            isLoading={queue.isLoading}
            isMutating={queue.isMutating}
            isOffline={queue.isOffline}
            error={queue.error}
            lastUpdatedAt={queue.lastUpdatedAt}
            onRefresh={queue.refresh}
            onChangeStatus={(ticketNumber, status) =>
              void handleStatusChange(ticketNumber, status)
            }
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

      {activeTicket && (
        <VitalsCaptureModal
          ticket={activeTicket}
          existing={effectiveVitals[activeTicket.ticketNumber]}
          nurseName={nurse.fullName}
          onClose={() => setActiveTicket(null)}
          onSave={handleSaveVitals}
        />
      )}
    </div>
  );
}
