import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { X, CalendarPlus, Loader2 } from "lucide-react";
import { toISODate } from "../../data/adminMockData";
import {
  createShift,
  getDepartments,
  getDoctors,
} from "../../services/scheduleApi";
import type {
  CreateShiftPayload,
  Department,
  Doctor,
  DoctorShift,
  DutyType,
  ShiftSession,
} from "../../services/scheduleApi";

interface CreateShiftModalProps {
  onClose: () => void;
  onCreated: (shift: DoctorShift) => void;
  initialDepartmentId?: number;
  initialDate?: string;
}

const SESSION_OPTIONS: { value: ShiftSession; label: string }[] = [
  { value: "MORNING", label: "Sáng (07:30 - 11:30)" },
  { value: "AFTERNOON", label: "Chiều (13:00 - 17:00)" },
];

const DUTY_TYPE_OPTIONS: { value: DutyType; label: string }[] = [
  { value: "OUTPATIENT", label: "Ngoại trú (Trực phòng khám)" },
  { value: "INPATIENT", label: "Nội trú (Trực nội trú / Thủ thuật)" },
];

export default function CreateShiftModal({
  onClose,
  onCreated,
  initialDepartmentId,
  initialDate,
}: CreateShiftModalProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | "">(
    initialDepartmentId ?? "",
  );
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(Boolean(initialDepartmentId));
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | "">("");
  const [shiftDate, setShiftDate] = useState(initialDate ?? toISODate(new Date()));
  const [session, setSession] = useState<ShiftSession>("MORNING");
  const [dutyType, setDutyType] = useState<DutyType>("OUTPATIENT");
  const [submitting, setSubmitting] = useState(false);

  const requestSeq = useRef(0);
  const confirmedDepartmentId = useRef<number | "">(initialDepartmentId ?? "");

  const selectedDepartment = departments.find(
    (d) => d.id === selectedDepartmentId,
  );
  const activeDoctors = doctors.filter((d) => d.active);
  const selectedDoctor = activeDoctors.find((d) => d.id === selectedDoctorId);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => getDepartments())
      .then((list) => {
        if (cancelled) return;
        setDepartments(list);
        if (confirmedDepartmentId.current === "" && list.length > 0 && list[0]) {
          const first = list[0];
          confirmedDepartmentId.current = first.id;
          setSelectedDepartmentId(first.id);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Không tải được danh sách Khoa từ DoctorScheduleService.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDepartmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedDepartmentId === "") return;
    const seq = ++requestSeq.current;
    Promise.resolve()
      .then(() => getDoctors(selectedDepartmentId))
      .then((list) => {
        if (seq !== requestSeq.current) return;
        setDoctors(list);
      })
      .catch((error: unknown) => {
        if (seq !== requestSeq.current) return;
        setDoctors([]);
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được danh sách Bác sĩ của Khoa.",
        );
      })
      .finally(() => {
        if (seq === requestSeq.current) setDoctorsLoading(false);
      });
  }, [selectedDepartmentId]);

  const handleDepartmentChange = useCallback((next: string) => {
    const parsed = Number(next);
    const nextDepartmentId: number | "" = Number.isNaN(parsed) ? "" : parsed;
    confirmedDepartmentId.current = nextDepartmentId;
    setSelectedDepartmentId(nextDepartmentId);
    setSelectedDoctorId("");
    setDoctors([]);
    if (nextDepartmentId !== "") setDoctorsLoading(true);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedDepartment) {
      toast.error("Vui lòng chọn Khoa cần phân ca.");
      return;
    }
    if (!selectedDoctor) {
      toast.error("Vui lòng chọn Bác sĩ trực.");
      return;
    }
    if (!shiftDate) {
      toast.error("Vui lòng chọn ngày trực.");
      return;
    }

    const payload: CreateShiftPayload = {
      doctorId: selectedDoctor.id,
      departmentId: selectedDepartment.id,
      shiftDate,
      session,
      dutyType,
    };

    setSubmitting(true);
    try {
      const created = await createShift(payload);
      toast.success(
        `Đã phân ca ${session === "MORNING" ? "Sáng" : "Chiều"} (${
          dutyType === "OUTPATIENT" ? "Ngoại trú" : "Nội trú"
        }) cho ${created.doctor.fullName} – ${selectedDepartment.name}.`,
        { duration: 4000 },
      );
      onCreated(created);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể phân ca trực. Vui lòng thử lại.",
        { duration: 4500 },
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Phân ca trực bác sĩ mới"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200/80 bg-white shadow-elevated">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarPlus size={18} className="text-slate-700" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">Phân Ca Trực Bác Sĩ</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Khoa điều trị *
              </label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                disabled={departmentsLoading || submitting}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                {departmentsLoading && (
                  <option value="">Đang tải danh sách Khoa...</option>
                )}
                {!departmentsLoading && departments.length === 0 && (
                  <option value="">-- Không có Khoa --</option>
                )}
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Bác sĩ trực *
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(Number(e.target.value))}
                disabled={doctorsLoading || submitting || selectedDepartmentId === ""}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">
                  {doctorsLoading
                    ? "Đang tải Bác sĩ..."
                    : "-- Chọn Bác sĩ --"}
                </option>
                {activeDoctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName} · {doctor.roomNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Ngày trực *
            </label>
            <input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              disabled={submitting}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Buổi trực *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SESSION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSession(opt.value)}
                  disabled={submitting}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    session === opt.value
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Hình thức trực *
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DUTY_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDutyType(opt.value)}
                    disabled={submitting}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      dutyType === opt.value
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Mỗi ca Ngoại trú mặc định tiếp nhận tối đa{" "}
              <span className="font-semibold text-slate-600">4 bệnh nhân / khung 60 phút</span>{" "}
              (chuẩn phòng khám). Mỗi ca phải có đủ ≥ 1 BS Ngoại trú và ≥ 1 BS Nội trú để mở
              tiếp nhận bệnh.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Đang phân ca...
                </>
              ) : (
                <>
                  <CalendarPlus size={16} aria-hidden="true" />
                  Phân Ca Trực
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}