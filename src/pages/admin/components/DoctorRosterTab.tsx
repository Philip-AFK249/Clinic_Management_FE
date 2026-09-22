import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Hourglass,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import { toISODate } from "../data/adminMockData";
import {
  getAvailableSlots,
  getDepartments,
  getShifts,
  validateRoster,
} from "../services/scheduleApi";
import type {
  Department,
  DoctorShift,
  DutyType,
  ShiftSession,
  TimeSlotResponse,
} from "../services/scheduleApi";
import CreateShiftModal from "./Modals/CreateShiftModal";

type RosterView = "MATRIX" | "SLOTS";

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
  const [view, setView] = useState<RosterView>("MATRIX");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [shifts, setShifts] = useState<DoctorShift[]>([]);
  const [slots, setSlots] = useState<TimeSlotResponse[]>([]);
  const [compliance, setCompliance] = useState<Record<ShiftSession, boolean | null>>(
    { MORNING: null, AFTERNOON: null },
  );
  const [shiftsLoading, setShiftsLoading] = useState(true);

  const requestSeq = useRef(0);

  const selectedDepartment = departments.find((d) => d.id === selectedDepartmentId);

  const loadDepartments = useCallback(() => {
    Promise.resolve()
      .then(() => setDepartmentsLoading(true))
      .then(() => getDepartments())
      .then((list) => {
        setDepartments(list);
        setSelectedDepartmentId((current) =>
          current !== "" ? current : (list[0]?.id ?? ""),
        );
      })
      .catch((error: unknown) => {
        setDepartments([]);
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được danh sách Khoa từ DoctorScheduleService.",
        );
      })
      .finally(() => setDepartmentsLoading(false));
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const loadRoster = useCallback((departmentId: number, date: string) => {
    const seq = ++requestSeq.current;
    Promise.resolve()
      .then(() => {
        if (seq !== requestSeq.current) return;
        setShiftsLoading(true);
        setShifts([]);
        setSlots([]);
        setCompliance({ MORNING: null, AFTERNOON: null });
      })
      .then(() =>
        Promise.all([
          getShifts(departmentId, date),
          getAvailableSlots(departmentId, date),
          validateRoster(departmentId, date, "MORNING"),
          validateRoster(departmentId, date, "AFTERNOON"),
        ]),
      )
      .then(([shiftList, slotList, morningOk, afternoonOk]) => {
        if (seq !== requestSeq.current) return;
        setShifts(shiftList);
        setSlots(slotList);
        setCompliance({ MORNING: morningOk, AFTERNOON: afternoonOk });
      })
      .catch((error: unknown) => {
        if (seq !== requestSeq.current) return;
        setCompliance({ MORNING: false, AFTERNOON: false });
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được dữ liệu lịch trực từ DoctorScheduleService.",
        );
      })
      .finally(() => {
        if (seq === requestSeq.current) setShiftsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedDepartmentId === "") return;
    void loadRoster(selectedDepartmentId, selectedDate);
  }, [selectedDepartmentId, selectedDate, loadRoster]);

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

  function handleCreatedShift() {
    if (selectedDepartmentId !== "") {
      void loadRoster(selectedDepartmentId, selectedDate);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Lịch Trực &amp; Phân Ca Bác Sĩ (DoctorScheduleService)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Phân bổ ca Sáng / Chiều (Ngoại trú &amp; Nội trú), giám sát tuân thủ và dung
            lượng khung 60 phút cho từng Khoa
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
        >
          <Plus size={16} aria-hidden="true" />
          Phân ca trực mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
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

        <div className="flex gap-1 rounded-lg border border-slate-200/80 bg-white p-1 shadow-card">
          <button
            type="button"
            onClick={() => setView("MATRIX")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "MATRIX"
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ClipboardList size={14} aria-hidden="true" />
            Phân ca &amp; Kiểm soát
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
      ) : view === "MATRIX" ? (
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

      {showCreateModal && (
        <CreateShiftModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreatedShift}
          initialDepartmentId={selectedDepartmentId === "" ? undefined : selectedDepartmentId}
          initialDate={selectedDate}
        />
      )}
    </div>
  );
}