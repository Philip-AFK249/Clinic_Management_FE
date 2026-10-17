import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Stethoscope,
  Users,
} from "lucide-react";
import type {
  DoctorShift,
  ShiftSession,
} from "../../admin/services/scheduleApi";
import type { NurseProfile } from "../../reception/data/nurseDirectory";

interface NurseDutyPanelProps {
  /** Today's shifts for the nurse's khoa, from DoctorScheduleService (:8081). */
  shifts: DoctorShift[];
  isLoading: boolean;
  error: string;
  /** `YYYY-MM-DD` the duty roster was loaded for. */
  date: string;
  nurse: NurseProfile;
  onRefresh: () => void;
}

const SESSION_LABELS: Record<ShiftSession, string> = {
  MORNING: "Ca Sáng (07:30 - 11:30)",
  AFTERNOON: "Ca Chiều (13:00 - 17:00)",
};

const SESSIONS: ShiftSession[] = ["MORNING", "AFTERNOON"];

const SESSION_CHIP: Record<ShiftSession, string> = {
  MORNING: "border-blue-200 bg-blue-50 text-blue-700",
  AFTERNOON: "border-amber-200 bg-amber-50 text-amber-700",
};

const DUTY_LABELS: Record<DoctorShift["dutyType"], string> = {
  OUTPATIENT: "Ngoại trú",
  INPATIENT: "Nội trú",
};

function isMine(shift: DoctorShift, nurse: NurseProfile): boolean {
  if (typeof shift.nurseId === "number" && shift.nurseId === nurse.id) return true;
  const name = (shift.nurseName ?? "").trim();
  return name.length > 0 && name === nurse.fullName.trim();
}

function dateLabelFrom(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/**
 * Who is on duty at this khoa today, and which điều dưỡng each shift is paired
 * with - the pairing the admin console writes through `POST /schedules/shifts`.
 * The signed-in nurse's own shifts are called out so the desk knows where they
 * are expected.
 */
export default function NurseDutyPanel({
  shifts,
  isLoading,
  error,
  date,
  nurse,
  onRefresh,
}: NurseDutyPanelProps) {
  const grouped = useMemo(() => {
    const buckets: Record<ShiftSession, DoctorShift[]> = {
      MORNING: [],
      AFTERNOON: [],
    };
    for (const shift of shifts) {
      const bucket = buckets[shift.session];
      if (bucket) bucket.push(shift);
    }
    return buckets;
  }, [shifts]);

  const mineCount = useMemo(
    () => shifts.filter((shift) => isMine(shift, nurse)).length,
    [shifts, nurse],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-white">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-bold leading-tight text-slate-900">
                Trực Bác Sĩ Hôm Nay
              </h2>
              <p className="text-[11px] text-slate-500">
                Ngày {dateLabelFrom(date)} &middot; {shifts.length} ca trực
                {mineCount > 0 && (
                  <span className="font-semibold text-violet-700">
                    {" "}
                    &middot; {mineCount} ca có bạn
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Làm mới ca trực"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {error && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface-light p-3">
        {isLoading && shifts.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-xl border border-slate-200/80 bg-white"
              />
            ))}
          </div>
        ) : shifts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Stethoscope className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-slate-700">
              Chưa phân ca trực cho ngày này
            </p>
            <p className="max-w-[240px] text-xs text-slate-500">
              Quản trị viên phân ca tại màn Lịch Trực &amp; Phân Ca.
            </p>
          </div>
        ) : (
          SESSIONS.map((session) => {
            const sessionShifts = grouped[session];
            return (
              <div
                key={session}
                className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                  <span
                    className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${SESSION_CHIP[session]}`}
                  >
                    {SESSION_LABELS[session]}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {sessionShifts.length} BS trực
                  </span>
                </div>

                {sessionShifts.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[11px] italic text-slate-300">
                    Chưa phân BS cho buổi này
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {sessionShifts.map((shift) => {
                      const mine = isMine(shift, nurse);
                      return (
                        <li
                          key={shift.id}
                          className={`flex items-start justify-between gap-2 px-3 py-2.5 ${
                            mine ? "bg-violet-50/70" : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-800">
                              {shift.doctor.title ? `${shift.doctor.title} ` : ""}
                              {shift.doctor.fullName}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                              <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-semibold text-slate-600">
                                {DUTY_LABELS[shift.dutyType]}
                              </span>
                              {shift.roomNumber && <span>{shift.roomNumber}</span>}
                              <span>&middot; tối đa {shift.maxPatientsPerSlot} BN/khung</span>
                            </p>
                            <p
                              className={`mt-1 truncate text-[11px] font-semibold ${
                                mine ? "text-violet-700" : "text-slate-600"
                              }`}
                            >
                              Điều dưỡng:{" "}
                              {shift.nurseName?.trim() || "Chưa phân điều dưỡng"}
                            </p>
                          </div>
                          {mine ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              Của bạn
                            </span>
                          ) : (
                            <span
                              title="Điều dưỡng khác được phân cho ca này"
                              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-400"
                            >
                              <Users className="h-3 w-3" aria-hidden="true" />
                              ĐD khác
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex h-9 shrink-0 items-center justify-between border-t border-slate-200/80 bg-white px-4 text-[10px] text-slate-400">
        <span>DoctorScheduleService :8081 &middot; /api/v1/schedules/shifts</span>
        <span>Ngoại trú = phòng khám &middot; Nội trú = buồng bệnh / thủ thuật</span>
      </div>
    </section>
  );
}
