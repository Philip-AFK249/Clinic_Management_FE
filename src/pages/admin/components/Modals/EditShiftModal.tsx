import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, PencilLine, Trash2, X } from "lucide-react";
import {
  deleteShift,
  getDoctors,
  getShifts,
  updateShift,
} from "../../services/scheduleApi";
import type {
  Doctor,
  DoctorShift,
  DutyType,
  ShiftSession,
  UpdateShiftPayload,
} from "../../services/scheduleApi";
import { nursesOfDepartment } from "../../../reception/data/nurseDirectory";

interface EditShiftModalProps {
  shift: DoctorShift;
  onClose: () => void;
  onUpdated: (shift: DoctorShift) => void;
  onDeleted: (shift: DoctorShift) => void;
}

const SESSION_OPTIONS: { value: ShiftSession; label: string }[] = [
  { value: "MORNING", label: "Sáng (07:30 - 11:30)" },
  { value: "AFTERNOON", label: "Chiều (13:00 - 17:00)" },
];

const SESSION_LABELS: Record<ShiftSession, string> = {
  MORNING: "Ca Sáng",
  AFTERNOON: "Ca Chiều",
};

const DUTY_TYPE_OPTIONS: { value: DutyType; label: string }[] = [
  { value: "OUTPATIENT", label: "Ngoại trú (Trực phòng khám)" },
  { value: "INPATIENT", label: "Nội trú (Trực nội trú / Thủ thuật)" },
];

const DUTY_LABELS: Record<DutyType, string> = {
  OUTPATIENT: "Ngoại trú",
  INPATIENT: "Nội trú",
};

/**
 * Inline editor for one ca trực: pre-populated from the tapped shift, saves
 * through `PUT /api/v1/schedules/shifts/{id}` and removes it through
 * `DELETE` after an explicit confirm.
 *
 * The pairing select cannot clear an existing điều dưỡng - DoctorScheduleService
 * skips null fields on update - so picking the khoa default simply omits the
 * pair and keeps whoever is stored (a note says so in that case).
 */
export default function EditShiftModal({
  shift,
  onClose,
  onUpdated,
  onDeleted,
}: EditShiftModalProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(
    shift.doctor.id,
  );
  const [selectedNurseId, setSelectedNurseId] = useState<number | "">(
    typeof shift.nurseId === "number" ? shift.nurseId : "",
  );
  const [shiftDate, setShiftDate] = useState(shift.shiftDate);
  const [session, setSession] = useState<ShiftSession>(shift.session);
  const [dutyType, setDutyType] = useState<DutyType>(shift.dutyType);
  const [maxPatients, setMaxPatients] = useState<number>(
    shift.maxPatientsPerSlot,
  );
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dayShifts, setDayShifts] = useState<DoctorShift[]>([]);

  const nurses = useMemo(
    () => nursesOfDepartment(shift.departmentId),
    [shift.departmentId],
  );
  // A stored pairing the local directory does not know about still has to be
  // selectable, otherwise saving would silently drop it.
  const nurseOptions = useMemo(() => {
    if (
      selectedNurseId === "" ||
      nurses.some((nurse) => nurse.id === selectedNurseId)
    ) {
      return nurses;
    }
    return [
      {
        id: selectedNurseId,
        fullName: shift.nurseName ?? "ĐD. đã phân ca",
        departmentId: shift.departmentId,
        email: "",
        roomNumber: undefined,
      },
      ...nurses,
    ];
  }, [nurses, selectedNurseId, shift.nurseName, shift.departmentId]);

  const busy = submitting || deleting;

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => getDoctors(shift.departmentId))
      .then((list) => {
        if (!cancelled) setDoctors(list);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDoctors([]);
          toast.error(
            error instanceof Error
              ? error.message
              : "Không tải được danh sách Bác sĩ của Khoa.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDoctorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shift.departmentId]);

  useEffect(() => {
    if (shiftDate === "") return;
    let cancelled = false;
    Promise.resolve()
      .then(() => getShifts(shift.departmentId, shiftDate))
      .then((list) => {
        if (!cancelled) setDayShifts(list);
      })
      .catch(() => {
        // A failed roster lookup only weakens the client-side conflict hint;
        // DoctorScheduleService still rejects a duplicate with 409.
        if (!cancelled) setDayShifts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [shift.departmentId, shiftDate]);

  const conflictShift = useMemo(() => {
    if (selectedDoctorId === 0) return null;
    return (
      dayShifts.find(
        (row) =>
          row.id !== shift.id &&
          row.session === session &&
          row.doctor.id === selectedDoctorId,
      ) ?? null
    );
  }, [dayShifts, selectedDoctorId, session, shift.id]);

  const activeDoctors = useMemo(
    () => doctors.filter((doctor) => doctor.active),
    [doctors],
  );
  // The shift's own bác sĩ has to stay selectable even when the fetched list
  // omits them (inactive row, stale roster), or the controlled select would
  // render blank and saving would silently swap the doctor.
  const doctorOptions = useMemo(() => {
    if (activeDoctors.some((doctor) => doctor.id === selectedDoctorId)) {
      return activeDoctors;
    }
    return [{ ...shift.doctor, active: true }, ...activeDoctors];
  }, [activeDoctors, selectedDoctorId, shift.doctor]);
  const hasStoredPairing = typeof shift.nurseId === "number";
  const pairingKept =
    hasStoredPairing && selectedNurseId !== shift.nurseId;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (selectedDoctorId === 0) {
      toast.error("Vui lòng chọn Bác sĩ trực.");
      return;
    }
    if (!shiftDate) {
      toast.error("Vui lòng chọn ngày trực.");
      return;
    }
    if (!Number.isFinite(maxPatients) || maxPatients < 1) {
      toast.error("Số bệnh nhân tối đa mỗi khung phải lớn hơn 0.");
      return;
    }
    if (conflictShift) {
      toast.warning(
        `Bác sĩ ${conflictShift.doctor.fullName} đã được phân công trực ${SESSION_LABELS[session]} ngày ${shiftDate}. Vui lòng chọn Bác sĩ khác hoặc đổi khung giờ.`,
      );
      return;
    }

    const payload: UpdateShiftPayload = {
      doctorId: selectedDoctorId,
      departmentId: shift.departmentId,
      shiftDate,
      session,
      dutyType,
      maxPatientsPerSlot: maxPatients,
      ...(selectedNurseId !== ""
        ? {
            nurseId: selectedNurseId,
            nurseName:
              nurseOptions.find((nurse) => nurse.id === selectedNurseId)
                ?.fullName ?? shift.nurseName ?? "",
          }
        : {}),
    };

    setSubmitting(true);
    try {
      const updated = await updateShift(shift.id, payload);
      toast.success(
        `Đã cập nhật ca ${session === "MORNING" ? "Sáng" : "Chiều"} (${
          DUTY_LABELS[dutyType]
        }) ngày ${shiftDate}.`,
        { duration: 4000 },
      );
      onUpdated(updated);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật ca trực. Vui lòng thử lại.",
        { duration: 4500 },
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete() {
    if (busy) return;
    const confirmed = window.confirm(
      `Xóa ca trực của ${shift.doctor.fullName} (${SESSION_LABELS[shift.session]}) ngày ${shift.shiftDate}? Bệnh nhân đã xếp vào ca này có thể phải phân ca lại.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    void (async () => {
      try {
        await deleteShift(shift.id);
        toast.success(
          `Đã xóa ca trực của ${shift.doctor.fullName} ngày ${shift.shiftDate}.`,
          { duration: 4000 },
        );
        onDeleted(shift);
        onClose();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Không thể xóa ca trực. Vui lòng thử lại.",
          { duration: 4500 },
        );
      } finally {
        setDeleting(false);
      }
    })();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cập nhật ca trực bác sĩ"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200/80 bg-white shadow-elevated">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <PencilLine size={18} className="text-slate-700" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">
                Cập Nhật Ca Trực
              </h3>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {shift.doctor.fullName} · {shift.doctor.roomNumber} ·{" "}
              {SESSION_LABELS[shift.session]} {shift.shiftDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Bác sĩ trực *
            </label>
            <select
              value={selectedDoctorId}
              onChange={(event) => setSelectedDoctorId(Number(event.target.value))}
              disabled={doctorsLoading || busy}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              {doctorsLoading && <option value="">Đang tải Bác sĩ...</option>}
              {!doctorsLoading && activeDoctors.length === 0 && (
                <option value="">-- Không có Bác sĩ --</option>
              )}
              {doctorOptions.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.fullName} · {doctor.roomNumber}
                </option>
              ))}
            </select>
            {conflictShift && (
              <p
                role="alert"
                className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800"
              >
                <AlertTriangle
                  size={13}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Bác sĩ {conflictShift.doctor.fullName} đã có ca trực{" "}
                  {SESSION_LABELS[session]} vào ngày này. Vui lòng chọn Bác sĩ
                  khác hoặc đổi khung giờ.
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Điều dưỡng phối hợp
            </label>
            <select
              value={selectedNurseId}
              onChange={(event) =>
                setSelectedNurseId(
                  event.target.value === "" ? "" : Number(event.target.value),
                )
              }
              disabled={busy}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">-- Để mặc định theo Khoa --</option>
              {nurseOptions.map((nurse) => (
                <option key={nurse.id} value={nurse.id}>
                  {nurse.fullName}
                  {nurse.roomNumber ? ` · ${nurse.roomNumber}` : ""}
                </option>
              ))}
            </select>
            {pairingKept && (
              <p className="mt-1 text-[11px] text-slate-400">
                Chọn "-- Để mặc định theo Khoa --" không bỏ được điều dưỡng đã
                gán; ca vẫn giữ {shift.nurseName ?? "người hiện tại"}. Hãy chọn
                một điều dưỡng khác để đổi.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Ngày trực *
            </label>
            <input
              type="date"
              value={shiftDate}
              onChange={(event) => setShiftDate(event.target.value)}
              disabled={busy}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Buổi trực *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SESSION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSession(option.value)}
                    disabled={busy}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      session === option.value
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Bệnh nhân tối đa / khung *
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxPatients}
                onChange={(event) =>
                  setMaxPatients(Number.parseInt(event.target.value, 10) || 0)
                }
                disabled={busy}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Hình thức trực *
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DUTY_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDutyType(option.value)}
                    disabled={busy}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      dutyType === option.value
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 size={15} aria-hidden="true" />
              )}
              Xóa ca trực
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={busy || conflictShift !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <PencilLine size={16} aria-hidden="true" />
                    Lưu thay đổi
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
