import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Hourglass,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import { toISODate } from "../data/adminMockData";
import {
  createShift,
  getAvailableSlots,
  getDepartments,
  getShifts,
  getWeeklyShifts,
  ScheduleApiError,
  validateRoster,
} from "../services/scheduleApi";
import type {
  CreateShiftPayload,
  Department,
  DoctorReference,
  DoctorShift,
  DutyType,
  ShiftSession,
  TimeSlotResponse,
} from "../services/scheduleApi";
import CreateShiftModal from "./Modals/CreateShiftModal";

type RosterView = "TIMETABLE" | "DAILY_MATRIX" | "SLOTS";

const SESSIONS: ShiftSession[] = ["MORNING", "AFTERNOON"];

const SESSION_TIMES: Record<ShiftSession, string> = {
  MORNING: "07:30 - 11:30",
  AFTERNOON: "13:00 - 17:00",
};

const SESSION_LABELS: Record<ShiftSession, string> = {
  MORNING: "Ca Sáng",
  AFTERNOON: "Ca Chiều",
};

const SESSION_SWATCH_COLORS: Record<ShiftSession, string> = {
  MORNING: "border-blue-200 bg-blue-50 text-blue-700",
  AFTERNOON: "border-amber-200 bg-amber-50 text-amber-700",
};

const DUTY_LABELS: Record<DutyType, string> = {
  OUTPATIENT: "Ngoại trú",
  INPATIENT: "Nội trú",
};

const DUTY_CHIP_COLORS: Record<DutyType, string> = {
  OUTPATIENT: "border-teal-200 bg-teal-50/60",
  INPATIENT: "border-purple-200 bg-purple-50/60",
};

const DUTY_TAG_COLORS: Record<DutyType, string> = {
  OUTPATIENT: "bg-teal-100 text-teal-800",
  INPATIENT: "bg-purple-100 text-purple-800",
};

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const WEEK_COLUMNS = "130px repeat(7, minmax(0, 1fr))";

function toShortTime(value: string): string {
  return value.slice(0, 5);
}

function slotSession(startTime: string): ShiftSession {
  const hour = Number.parseInt(startTime.slice(0, 2), 10);
  return Number.isNaN(hour) || hour < 12 ? "MORNING" : "AFTERNOON";
}

function slotLoadPercentage(slot: TimeSlotResponse): number {
  if (slot.totalCapacity <= 0) return 0;
  return Math.min(
    100,
    Math.round((slot.bookedCount / slot.totalCapacity) * 100),
  );
}

function getWeekStartDate(anchor: Date): Date {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const weekday = start.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + diff);
  return start;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-");
  return new Date(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10),
  );
}

function formatShortVN(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function formatVNDate(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function shortLastName(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  return tokens[tokens.length - 1] ?? "";
}

function DutyTag({ dutyType }: { dutyType: DutyType }) {
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${DUTY_TAG_COLORS[dutyType]}`}
    >
      {DUTY_LABELS[dutyType]}
    </span>
  );
}

function DoctorChip({ shift }: { shift: DoctorShift }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${DUTY_CHIP_COLORS[shift.dutyType]}`}
    >
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold text-slate-800">
          {shift.doctor.fullName}
        </p>
        <p className="truncate text-[10px] text-slate-500">
          {shift.doctor.title} · {shift.doctor.roomNumber} · Tối đa{" "}
          {shift.maxPatientsPerSlot} BN/giờ
        </p>
      </div>
      <DutyTag dutyType={shift.dutyType} />
    </div>
  );
}

function TimetableDoctorBadge({
  doctor,
  dutyType,
  showRoom,
}: {
  doctor: DoctorReference;
  dutyType: DutyType;
  showRoom: boolean;
}) {
  const color =
    dutyType === "OUTPATIENT"
      ? "border-teal-200 bg-teal-50 text-teal-800"
      : "border-purple-200 bg-purple-50 text-purple-800";
  const suffix =
    dutyType === "OUTPATIENT"
      ? showRoom && doctor.roomNumber
        ? ` (${doctor.roomNumber})`
        : ""
      : " (Nội trú)";
  return (
    <p className={`truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${color}`}>
      {doctor.title}
      {doctor.title ? " " : ""}
      {shortLastName(doctor.fullName)}
      {suffix}
    </p>
  );
}

interface TimetableCellProps {
  dateISO: string;
  dayLabel: string;
  isToday: boolean;
  session: ShiftSession;
  shifts: DoctorShift[];
  onQuickAdd: () => void;
}

function TimetableCell({
  dateISO,
  dayLabel,
  isToday,
  session,
  shifts,
  onQuickAdd,
}: TimetableCellProps) {
  const outpatientShifts = shifts.filter((s) => s.dutyType === "OUTPATIENT");
  const inpatientShifts = shifts.filter((s) => s.dutyType === "INPATIENT");
  const compliant =
    outpatientShifts.length >= 1 && inpatientShifts.length >= 1;

  return (
    <div
      className={`group relative flex min-h-[118px] flex-col gap-1.5 border-l border-slate-100 p-2 ${
        isToday ? "bg-sky-50/60" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
            isToday ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          {isToday ? "Hôm nay" : dayLabel}
        </span>
        <button
          type="button"
          onClick={onQuickAdd}
          title={`Phân ca nhanh - ${SESSION_LABELS[session]} ${dayLabel}`}
          aria-label={`Phân ca nhanh ${dateISO} - ${SESSION_LABELS[session]}`}
          className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-white opacity-0 transition-opacity hover:bg-slate-900 group-hover:opacity-100"
        >
          <Plus size={12} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-1">
        {outpatientShifts.length > 0 && (
          <div className="space-y-0.5">
            {outpatientShifts.slice(0, 2).map((shift) => (
              <TimetableDoctorBadge
                key={shift.id}
                doctor={shift.doctor}
                dutyType="OUTPATIENT"
                showRoom
              />
            ))}
            {outpatientShifts.length > 2 && (
              <p className="text-[9px] font-medium text-slate-400">
                +{outpatientShifts.length - 2} BS khác
              </p>
            )}
          </div>
        )}
        {inpatientShifts.length > 0 && (
          <div className="space-y-0.5">
            {inpatientShifts.slice(0, 2).map((shift) => (
              <TimetableDoctorBadge
                key={shift.id}
                doctor={shift.doctor}
                dutyType="INPATIENT"
                showRoom={false}
              />
            ))}
            {inpatientShifts.length > 2 && (
              <p className="text-[9px] font-medium text-slate-400">
                +{inpatientShifts.length - 2} BS khác
              </p>
            )}
          </div>
        )}
        {outpatientShifts.length === 0 && inpatientShifts.length === 0 && (
          <p className="text-[9px] italic text-slate-300">Chưa phân ca</p>
        )}
      </div>

      <div className="mt-auto pt-0.5">
        {compliant ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
            <CheckCircle2 size={11} aria-hidden="true" />
            Đủ BS Ngoại trú &amp; Nội trú
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">
            <AlertTriangle size={11} aria-hidden="true" />
            Thiếu BS hoặc chưa đủ 2 loại
          </span>
        )}
      </div>
    </div>
  );
}

function ComplianceBadge({ compliant }: { compliant: boolean | null }) {
  if (compliant === null) {
    return (
      <span className="inline-flex items-start gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
        <Loader2
          size={13}
          className="mt-0.5 shrink-0 animate-spin"
          aria-hidden="true"
        />
        <span>
          Đang kiểm tra chuẩn ca trực
          <span className="mt-0.5 block font-normal text-slate-400">
            Đối chiếu BS Ngoại trú &amp; Nội trú...
          </span>
        </span>
      </span>
    );
  }

  if (compliant) {
    return (
      <span className="inline-flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2
          size={13}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <span>
          Đạt chuẩn ca trực
          <span className="mt-0.5 block font-normal text-emerald-600">
            Đủ BS Ngoại trú &amp; Nội trú
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
      <AlertTriangle
        size={13}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <span>
        Chưa đạt chuẩn
        <span className="mt-0.5 block font-normal text-amber-600">
          Thiếu BS Ngoại trú hoặc Nội trú - Khóa tiếp nhận
        </span>
      </span>
    </span>
  );
}

function SlotCard({ slot }: { slot: TimeSlotResponse }) {
  const percentage = slotLoadPercentage(slot);
  const barColor =
    percentage >= 100
      ? "bg-red-500"
      : percentage >= 50
        ? "bg-amber-500"
        : "bg-teal-500";

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700">
            {toShortTime(slot.startTime)} - {toShortTime(slot.endTime)}
          </span>
          {slot.isAvailable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Mở nhận bệnh
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              <Hourglass size={10} aria-hidden="true" />
              Đã khóa / Hết chỗ
            </span>
          )}
        </div>
        <span className="text-[11px] font-bold text-slate-800">
          {slot.bookedCount}/{slot.totalCapacity} BN
        </span>
      </div>

      <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>{percentage}% dung lượng</span>
        <span>
          Còn{" "}
          <span className="font-semibold text-slate-600">
            {slot.availableCapacity}
          </span>{" "}
          chỗ trống
        </span>
      </div>
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-6 py-12 shadow-card">
      <Loader2 size={22} className="animate-spin text-slate-400" aria-hidden="true" />
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function EmptyDepartments({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-card">
      <Stethoscope size={24} className="text-slate-300" aria-hidden="true" />
      <p className="text-xs font-medium text-slate-500">
        Không tải được danh sách Khoa từ DoctorScheduleService
        (http://localhost:8081).
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        <RefreshCw size={13} aria-hidden="true" />
        Tải lại danh sách Khoa
      </button>
    </div>
  );
}

export default function DoctorRosterTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | "">("");
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [view, setView] = useState<RosterView>("TIMETABLE");
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStartDate(new Date()));
  const [createTarget, setCreateTarget] = useState<{
    date?: string;
    session?: ShiftSession;
  } | null>(null);

  const [shifts, setShifts] = useState<DoctorShift[]>([]);
  const [slots, setSlots] = useState<TimeSlotResponse[]>([]);
  const [weeklyShifts, setWeeklyShifts] = useState<DoctorShift[]>([]);
  const [compliance, setCompliance] = useState<Record<ShiftSession, boolean | null>>(
    { MORNING: null, AFTERNOON: null },
  );
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [isCopying, setIsCopying] = useState(false);

  const departmentsSeq = useRef(0);
  const rosterSeq = useRef(0);
  const weeklySeq = useRef(0);
  const departmentsAbortRef = useRef<AbortController | null>(null);
  const rosterAbortRef = useRef<AbortController | null>(null);
  const weeklyAbortRef = useRef<AbortController | null>(null);

  const selectedDepartment = departments.find((d) => d.id === selectedDepartmentId);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const weekISO = useMemo(() => weekDates.map(toISODate), [weekDates]);

  const weekLabel = useMemo(
    () =>
      weekDates.length === 7
        ? `${formatVNDate(weekDates[0])} - ${formatVNDate(weekDates[weekDates.length - 1])}`
        : "",
    [weekDates],
  );

  const todayISO = useMemo(() => toISODate(new Date()), []);

  const loadDepartments = useCallback(() => {
    departmentsAbortRef.current?.abort();
    const controller = new AbortController();
    departmentsAbortRef.current = controller;
    const seq = ++departmentsSeq.current;
    Promise.resolve()
      .then(() => setDepartmentsLoading(true))
      .then(() => getDepartments(controller.signal))
      .then((list) => {
        if (seq !== departmentsSeq.current) return;
        setDepartments(list);
        setSelectedDepartmentId((current) =>
          current !== "" ? current : (list[0]?.id ?? ""),
        );
      })
      .catch((error: unknown) => {
        if (axios.isCancel(error)) return;
        if (seq !== departmentsSeq.current) return;
        setDepartments([]);
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được danh sách Khoa từ DoctorScheduleService.",
        );
      })
      .finally(() => {
        if (seq === departmentsSeq.current) setDepartmentsLoading(false);
      });
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const loadRoster = useCallback((departmentId: number, date: string) => {
    rosterAbortRef.current?.abort();
    const controller = new AbortController();
    rosterAbortRef.current = controller;
    const seq = ++rosterSeq.current;
    Promise.resolve()
      .then(() => {
        if (seq !== rosterSeq.current) return;
        setShiftsLoading(true);
        setShifts([]);
        setSlots([]);
        setCompliance({ MORNING: null, AFTERNOON: null });
      })
      .then(() =>
        Promise.all([
          getShifts(departmentId, date, controller.signal),
          getAvailableSlots(departmentId, date, controller.signal),
          validateRoster(departmentId, date, "MORNING", controller.signal),
          validateRoster(departmentId, date, "AFTERNOON", controller.signal),
        ]),
      )
      .then(([shiftList, slotList, morningOk, afternoonOk]) => {
        if (seq !== rosterSeq.current) return;
        setShifts(shiftList);
        setSlots(slotList);
        setCompliance({ MORNING: morningOk, AFTERNOON: afternoonOk });
      })
      .catch((error: unknown) => {
        if (axios.isCancel(error)) return;
        if (seq !== rosterSeq.current) return;
        setCompliance({ MORNING: false, AFTERNOON: false });
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được dữ liệu lịch trực từ DoctorScheduleService.",
        );
      })
      .finally(() => {
        if (seq === rosterSeq.current) setShiftsLoading(false);
      });
  }, []);

  const loadWeeklyRoster = useCallback((departmentId: number, start: Date) => {
    const startISO = toISODate(start);
    const endISO = toISODate(addDays(start, 6));
    weeklyAbortRef.current?.abort();
    const controller = new AbortController();
    weeklyAbortRef.current = controller;
    const seq = ++weeklySeq.current;
    Promise.resolve()
      .then(() => {
        if (seq !== weeklySeq.current) return;
        setWeeklyLoading(true);
        setWeeklyShifts([]);
      })
      .then(() => getWeeklyShifts(departmentId, startISO, endISO, controller.signal))
      .then((list) => {
        if (seq !== weeklySeq.current) return;
        setWeeklyShifts(list);
      })
      .catch((error: unknown) => {
        if (axios.isCancel(error)) return;
        if (seq !== weeklySeq.current) return;
        setWeeklyShifts([]);
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được thời khoá biểu tuần từ DoctorScheduleService.",
        );
      })
      .finally(() => {
        if (seq === weeklySeq.current) setWeeklyLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedDepartmentId === "") return;
    void loadRoster(selectedDepartmentId, selectedDate);
  }, [selectedDepartmentId, selectedDate, view, loadRoster]);

  useEffect(() => {
    if (selectedDepartmentId === "") return;
    void loadWeeklyRoster(selectedDepartmentId, weekStart);
  }, [selectedDepartmentId, weekStart, loadWeeklyRoster]);

  useEffect(() => {
    return () => {
      departmentsAbortRef.current?.abort();
      rosterAbortRef.current?.abort();
      weeklyAbortRef.current?.abort();
    };
  }, []);

  const weeklyByCell = useMemo(() => {
    const grouped: Record<ShiftSession, Record<string, DoctorShift[]>> = {
      MORNING: {},
      AFTERNOON: {},
    };
    for (const session of SESSIONS) {
      for (const iso of weekISO) {
        grouped[session][iso] = [];
      }
    }
    for (const shift of weeklyShifts) {
      const bucket = grouped[shift.session];
      if (bucket && bucket[shift.shiftDate]) {
        bucket[shift.shiftDate]!.push(shift);
      }
    }
    return grouped;
  }, [weeklyShifts, weekISO]);

  const sessionPlans = useMemo(
    () =>
      SESSIONS.map((session) => {
        const sessionShifts = shifts.filter((s) => s.session === session);
        const outpatientShifts = sessionShifts.filter(
          (s) => s.dutyType === "OUTPATIENT",
        );
        const inpatientShifts = sessionShifts.filter(
          (s) => s.dutyType === "INPATIENT",
        );
        return {
          session,
          outpatientShifts,
          inpatientShifts,
          totalDoctors: sessionShifts.length,
          outpatientCount: outpatientShifts.length,
          inpatientCount: inpatientShifts.length,
          outpatientCapacity: outpatientShifts.reduce(
            (sum, s) => sum + s.maxPatientsPerSlot,
            0,
          ),
        };
      }),
    [shifts],
  );

  const compliantCount = useMemo(
    () => SESSIONS.filter((s) => compliance[s] === true).length,
    [compliance],
  );

  const hasPendingValidation = useMemo(
    () => SESSIONS.some((s) => compliance[s] === null),
    [compliance],
  );

  const slotsBySession = useMemo(() => {
    const grouped: Record<ShiftSession, TimeSlotResponse[]> = {
      MORNING: [],
      AFTERNOON: [],
    };
    for (const slot of slots) {
      grouped[slotSession(slot.startTime)].push(slot);
    }
    return grouped;
  }, [slots]);

  function goToPreviousWeek() {
    setWeekStart((current) => addDays(current, -7));
  }

  function goToNextWeek() {
    setWeekStart((current) => addDays(current, 7));
  }

  function goToThisWeek() {
    setWeekStart(getWeekStartDate(new Date()));
  }

  async function handleCopyToNextWeek() {
    if (selectedDepartmentId === "" || isCopying || weeklyLoading) return;

    if (weeklyShifts.length === 0) {
      toast.warning("Tuần hiện tại chưa có ca trực nào để sao chép.");
      return;
    }

    const departmentId = selectedDepartmentId;
    const targetWeekStart = addDays(weekStart, 7);
    const shiftsToCreate: CreateShiftPayload[] = weeklyShifts.map((shift) => ({
      doctorId: shift.doctor.id,
      departmentId,
      shiftDate: toISODate(addDays(parseISODate(shift.shiftDate), 7)),
      session: shift.session,
      dutyType: shift.dutyType,
    }));

    setIsCopying(true);
    try {
      const results = await Promise.allSettled(
        shiftsToCreate.map((payload) => createShift(payload)),
      );

      let createdCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;
      let failureMessage: string | null = null;

      for (const result of results) {
        if (result.status === "fulfilled") {
          createdCount += 1;
          continue;
        }
        const reason: unknown = result.reason;
        if (reason instanceof ScheduleApiError && reason.status === 409) {
          duplicateCount += 1;
          continue;
        }
        failedCount += 1;
        failureMessage ??=
          reason instanceof Error
            ? reason.message
            : "Không tạo được ca trực từ DoctorScheduleService.";
      }

      if (failedCount > 0 && createdCount === 0) {
        toast.error(
          failureMessage ?? "Không sao chép được ca trực sang tuần sau.",
          { duration: 4500 },
        );
      } else if (failedCount > 0) {
        toast.warning(
          `Đã sao chép ${createdCount} ca trực sang tuần tiếp theo, ${failedCount} ca không tạo được.`,
          { duration: 4500 },
        );
      } else if (createdCount > 0) {
        toast.success(
          `Đã sao chép thành công ${createdCount} ca trực sang tuần tiếp theo!${
            duplicateCount > 0
              ? ` (${duplicateCount} ca đã tồn tại được giữ nguyên)`
              : ""
          }`,
          { duration: 4000 },
        );
      } else {
        toast.info(
          "Lịch trực tuần sau đã có đầy đủ, không có ca mới nào cần thêm.",
        );
      }

      setWeekStart(targetWeekStart);
      void loadWeeklyRoster(departmentId, targetWeekStart);
    } finally {
      setIsCopying(false);
    }
  }

  function handleCreatedShift(createdShift?: DoctorShift) {
    if (selectedDepartmentId === "") return;
    const departmentId = selectedDepartmentId;
    const createdDate = createdShift?.shiftDate;
    const rosterDate = createdDate ?? selectedDate;
    if (createdDate) setSelectedDate(createdDate);
    void Promise.all([
      loadWeeklyRoster(departmentId, weekStart),
      loadRoster(departmentId, rosterDate),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Lịch Trực &amp; Phân Ca Bác Sĩ (DoctorScheduleService)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Thời khoá biểu tuần, phân bổ ca Sáng / Chiều (Ngoại trú &amp; Nội trú) và
            giám sát dung lượng khung 60 phút cho từng Khoa
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateTarget({ date: selectedDate })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
        >
          <Plus size={16} aria-hidden="true" />
          Phân ca trực mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {view === "TIMETABLE" ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white p-1 shadow-card">
              <button
                type="button"
                onClick={goToPreviousWeek}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                Tuần trước
              </button>
              <button
                type="button"
                onClick={goToThisWeek}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Tuần này
              </button>
              <button
                type="button"
                onClick={goToNextWeek}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Tuần sau
                <ChevronRight size={14} aria-hidden="true" />
              </button>
              <span className="mx-1 inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                <CalendarRange size={14} className="text-slate-400" aria-hidden="true" />
                {weekLabel}
              </span>
            </div>
          ) : (
            <div className="relative">
              <CalendarDays
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
          )}
          {view === "TIMETABLE" && selectedDepartmentId !== "" && (
            <button
              type="button"
              onClick={() => void handleCopyToNextWeek()}
              disabled={weeklyLoading || isCopying}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-card transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCopying ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
              {isCopying ? "Đang sao chép..." : "Sao chép sang tuần sau"}
            </button>
          )}
          <select
            value={selectedDepartmentId}
            onChange={(e) =>
              setSelectedDepartmentId(
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
            className="h-9 w-64 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
          >
            <option value="">-- Chọn Khoa --</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200/80 bg-white p-1 shadow-card">
          <button
            type="button"
            onClick={() => setView("TIMETABLE")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "TIMETABLE"
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <CalendarRange size={14} aria-hidden="true" />
            Thời khoá biểu tuần
          </button>
          <button
            type="button"
            onClick={() => setView("DAILY_MATRIX")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "DAILY_MATRIX"
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ClipboardList size={14} aria-hidden="true" />
            Phân ca ngày &amp; Kiểm soát
          </button>
          <button
            type="button"
            onClick={() => setView("SLOTS")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "SLOTS"
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <LayoutGrid size={14} aria-hidden="true" />
            Giám sát Slot 60 phút
          </button>
        </div>
      </div>

      {departmentsLoading ? (
        <LoadingBlock label="Đang tải danh sách Khoa..." />
      ) : departments.length === 0 ? (
        <EmptyDepartments onRetry={loadDepartments} />
      ) : selectedDepartmentId === "" ? (
        <LoadingBlock label="Vui lòng chọn Khoa điều trị để xem lịch trực." />
      ) : view === "TIMETABLE" ? (
        <>
          <div className="mb-1 flex items-center gap-2">
            <CalendarRange size={16} className="text-slate-500" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">
              Thời khoá biểu tuần - {selectedDepartment?.name ?? "Khoa"}
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              7 ngày × 2 ca
            </span>
          </div>

          {weeklyLoading ? (
            <LoadingBlock label="Đang tải thời khoá biểu tuần từ DoctorScheduleService..." />
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
                <div className="overflow-x-auto">
                  <div className="min-w-[980px]">
                    {/* Header row */}
                    <div
                      className="grid border-b border-slate-100 bg-slate-50"
                      style={{ gridTemplateColumns: WEEK_COLUMNS }}
                    >
                      <div className="px-3 py-2 text-xs font-semibold text-slate-600">
                        Ca trực
                      </div>
                      {weekDates.map((day, index) => {
                        const iso = weekISO[index];
                        const isToday = iso === todayISO;
                        const isSelected = iso === selectedDate;
                        return (
                          <button
                            key={iso}
                            type="button"
                            onClick={() => setSelectedDate(iso)}
                            title={`Chọn ngày ${formatShortVN(day)} để xem Phân ca ngày`}
                            aria-label={`Chọn ngày ${formatVNDate(day)}`}
                            aria-pressed={isSelected}
                            className={`border-l border-slate-100 px-3 py-2 text-center transition-colors hover:bg-sky-50 ${
                              isToday ? "bg-sky-100/70" : ""
                            } ${isSelected ? "ring-2 ring-inset ring-slate-800" : ""}`}
                          >
                            <p className="text-xs font-bold text-slate-800">
                              {DAY_LABELS[index]}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatShortVN(day)}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Session rows */}
                    {SESSIONS.map((session) => (
                      <div
                        key={session}
                        className="grid border-b border-slate-100 last:border-b-0"
                        style={{ gridTemplateColumns: WEEK_COLUMNS }}
                      >
                        <div className="flex items-center bg-slate-50/60 px-3 py-2">
                          <span
                            className={`inline-flex flex-col rounded-lg border px-2 py-1 text-[10px] font-bold ${SESSION_SWATCH_COLORS[session]}`}
                          >
                            {SESSION_LABELS[session]}
                            <span className="text-[9px] font-medium">
                              {SESSION_TIMES[session]}
                            </span>
                          </span>
                        </div>
                        {weekDates.map((day, index) => {
                          const iso = weekISO[index];
                          return (
                            <TimetableCell
                              key={iso}
                              dateISO={iso}
                              dayLabel={formatShortVN(day)}
                              isToday={iso === todayISO}
                              session={session}
                              shifts={weeklyByCell[session][iso] ?? []}
                              onQuickAdd={() => {
                                setSelectedDate(iso);
                                setCreateTarget({ date: iso, session });
                              }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 font-semibold text-teal-800">
                    Ngoại trú
                  </span>
                  Bác sĩ khám bệnh nhân tại phòng khám
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 font-semibold text-purple-800">
                    Nội trú
                  </span>
                  Trực buồng bệnh / thủ thuật
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 size={12} aria-hidden="true" />
                  Đạt chuẩn: đủ ≥ 1 BS Ngoại trú &amp; ≥ 1 BS Nội trú
                </span>
                <span className="text-slate-400">
                  Nhấn "+" tại ô khung giờ để phân ca nhanh cho ngày / buổi đó.
                </span>
              </div>
            </>
          )}
        </>
      ) : view === "DAILY_MATRIX" ? (
        <>
          {/* Compliance summary */}
          <div
            className={`flex items-center gap-3 rounded-xl border p-4 shadow-card ${
              hasPendingValidation
                ? "border-slate-200 bg-slate-50/60"
                : compliantCount >= 2
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-amber-200 bg-amber-50/50"
            }`}
          >
            {hasPendingValidation ? (
              <Loader2 size={18} className="animate-spin text-slate-400" aria-hidden="true" />
            ) : compliantCount >= 2 ? (
              <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
            ) : (
              <AlertTriangle size={18} className="text-amber-600" aria-hidden="true" />
            )}
            <div className="min-w-0 text-xs">
              <p
                className={`font-bold ${
                  hasPendingValidation
                    ? "text-slate-600"
                    : compliantCount >= 2
                      ? "text-emerald-800"
                      : "text-amber-800"
                }`}
              >
                {selectedDepartment?.name ?? "Khoa"} · {compliantCount}/2 ca trực đạt
                chuẩn điều kiện mở khám
              </p>
              <p className="mt-0.5 text-slate-500">
                {hasPendingValidation
                  ? "Đang đối chiếu chuẩn ca trực với DoctorScheduleService..."
                  : "Mỗi ca phải có ≥ 1 BS Ngoại trú và ≥ 1 BS Nội trú thì mới được tiếp nhận bệnh nhân tại quầy."}
              </p>
            </div>
          </div>

          {shiftsLoading ? (
            <LoadingBlock label="Đang tải lịch trực &amp; kiểm tra tuân thủ..." />
          ) : (
            <>
              {/* Compliance matrix */}
              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="w-40 px-4 py-3 font-semibold text-slate-600">
                          Ca trực
                        </th>
                        <th className="w-1/3 px-4 py-3 font-semibold text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <Stethoscope size={13} className="text-teal-600" aria-hidden="true" />
                            BS Ngoại trú (Phòng khám)
                          </span>
                        </th>
                        <th className="w-1/3 px-4 py-3 font-semibold text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <Activity size={13} className="text-purple-500" aria-hidden="true" />
                            BS Nội trú (Thủ thuật / Trực)
                          </span>
                        </th>
                        <th className="w-56 px-4 py-3 font-semibold text-slate-600">
                          Kiểm soát tuân thủ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessionPlans.map((plan) => (
                        <tr
                          key={plan.session}
                          className="align-top transition-colors hover:bg-slate-50/40"
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex flex-col rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${SESSION_SWATCH_COLORS[plan.session]}`}
                            >
                              {SESSION_LABELS[plan.session]}
                              <span className="text-[10px] font-medium">
                                {SESSION_TIMES[plan.session]}
                              </span>
                            </span>
                            <p className="mt-1.5 text-[10px] text-slate-400">
                              {plan.totalDoctors} BS · {plan.outpatientCapacity} BN/khung
                              (Ngoại trú)
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {plan.outpatientShifts.length === 0 ? (
                              <span className="text-[11px] italic text-slate-300">
                                Chưa phân BS Ngoại trú
                              </span>
                            ) : (
                              <div className="space-y-1.5">
                                {plan.outpatientShifts.map((shift) => (
                                  <DoctorChip key={shift.id} shift={shift} />
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {plan.inpatientShifts.length === 0 ? (
                              <span className="text-[11px] italic text-slate-300">
                                Chưa phân BS Nội trú
                              </span>
                            ) : (
                              <div className="space-y-1.5">
                                {plan.inpatientShifts.map((shift) => (
                                  <DoctorChip key={shift.id} shift={shift} />
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ComplianceBadge compliant={compliance[plan.session]} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 font-semibold text-teal-800">
                    Ngoại trú
                  </span>
                  Bác sĩ khám bệnh nhân tại phòng khám
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 font-semibold text-purple-800">
                    Nội trú
                  </span>
                  Trực buồng bệnh / thủ thuật
                </span>
                <span>•</span>
                <span className="text-slate-400">
                  Dung lượng mỗi khung 60 phút do DoctorScheduleService tính theo số BS
                  Ngoại trú đang trực.
                </span>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {/* Slot monitor */}
          <div className="mb-1 flex items-center gap-2">
            <Hourglass size={16} className="text-slate-500" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">
              Cân bằng tải khung 60 phút - {selectedDepartment?.name ?? "Khoa"}
            </h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              Least-Busy Load Balancing
            </span>
          </div>

          {shiftsLoading ? (
            <LoadingBlock label="Đang tải dữ liệu khung 60 phút..." />
          ) : slots.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-card">
              <Hourglass size={20} className="text-slate-300" aria-hidden="true" />
              <p className="text-xs font-medium text-slate-500">
                Không có khung 60 phút nào được trả về cho Khoa này vào ngày đã chọn.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {SESSIONS.map((session) => {
                  const sessionSlots = slotsBySession[session];
                  const capacityPerSlot =
                    sessionSlots.length > 0 ? sessionSlots[0].totalCapacity : 0;
                  return (
                    <div
                      key={session}
                      className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">
                            Ca {SESSION_LABELS[session]} · {SESSION_TIMES[session]}
                          </h4>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            Dung lượng mỗi khung 60 phút:{" "}
                            <span className="font-semibold text-slate-600">
                              {capacityPerSlot} BN
                            </span>{" "}
                            · Đỏ ≥ 100%, Vàng 50-99%, Xanh &lt; 50%
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        {sessionSlots.map((slot, index) => (
                          <SlotCard
                            key={`${slot.startTime}-${index}`}
                            slot={slot}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                Hệ thống định tuyến bệnh nhân vào khung giờ theo cơ chế{" "}
                <span className="font-semibold text-slate-700">Least-Busy</span>: bệnh
                nhân mới được xếp vào bác sĩ đang có ít bệnh nhân nhất ("Ít bận nhất")
                trong khung giờ hiện tại.
              </div>
            </>
          )}
        </>
      )}

      {createTarget !== null && (
        <CreateShiftModal
          onClose={() => setCreateTarget(null)}
          onCreated={handleCreatedShift}
          initialDepartmentId={selectedDepartmentId === "" ? undefined : selectedDepartmentId}
          initialDate={createTarget.date}
          initialSession={createTarget.session}
          existingShifts={weeklyShifts}
        />
      )}
    </div>
  );
}