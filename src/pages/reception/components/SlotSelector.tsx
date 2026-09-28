import { useMemo } from "react";
import {
  Building2,
  CalendarDays,
  Loader2,
  RefreshCw,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import FormField from "./FormField";
import { controlClass } from "../formStyles";
import type { IntakeErrors, IntakeFormState } from "../hooks/useIntakeForm";
import {
  RECEPTION_DEPARTMENTS,
  appointmentDateOptions,
  isToday,
} from "../data/receptionMockData";
import type { TimeSlotResponse } from "../../../services/intakeApi";

interface SlotSelectorProps {
  form: IntakeFormState;
  errors: IntakeErrors;
  slots: TimeSlotResponse[];
  isLoading: boolean;
  isOffline: boolean;
  loadError: string;
  onChange: <K extends keyof IntakeFormState>(
    field: K,
    value: IntakeFormState[K],
  ) => void;
  onRefresh: () => void;
  /** Fired whenever the secretary commits to a new slot. */
  onSlotSelected?: () => void;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** A slot is gone once its end time has passed on the current day. */
function isPastSlot(slot: TimeSlotResponse, appointmentDate: string): boolean {
  if (!isToday(appointmentDate, new Date())) return false;
  const now = new Date();
  return minutesOf(slot.endTime) <= now.getHours() * 60 + now.getMinutes();
}

function blockLabel(startTime: string): string {
  return minutesOf(startTime) < 12 * 60 ? "Buổi sáng" : "Buổi chiều";
}

export default function SlotSelector({
  form,
  errors,
  slots,
  isLoading,
  isOffline,
  loadError,
  onChange,
  onRefresh,
  onSlotSelected,
}: SlotSelectorProps) {
  const dateOptions = useMemo(() => appointmentDateOptions(new Date()), []);
  const activeDepartment = RECEPTION_DEPARTMENTS.find(
    (department) => department.id === form.departmentId,
  );

  const grouped = useMemo(() => {
    const blocks = new Map<string, TimeSlotResponse[]>();
    for (const slot of slots) {
      const key = blockLabel(slot.startTime);
      const bucket = blocks.get(key);
      if (bucket) bucket.push(slot);
      else blocks.set(key, [slot]);
    }
    return [...blocks.entries()];
  }, [slots]);

  const openSlots = slots.filter((slot) => slot.isAvailable).length;

  function selectDepartment(departmentId: number) {
    onChange("departmentId", departmentId);
    // Slot capacity is per department, so the previous pick no longer applies.
    onChange("slotStartTime", "");
  }

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold leading-tight text-slate-900">
              Định Tuyến Lâm Sàng &amp; Chọn Khung Giờ
            </h2>
            <p className="text-[11px] text-slate-500">
              Khung giờ 60 phút &middot; cân bằng tải từ DoctorScheduleService
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {openSlots > 0 && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {openSlots}/{slots.length} khung giờ còn trống
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Tải lại khung giờ khả dụng"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-teal-700 disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Department routing */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div id="intake-department">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Chuyên khoa tiếp nhận
            <span className="ml-0.5 text-red-500">*</span>
          </p>
          <div
            role="radiogroup"
            aria-label="Chọn chuyên khoa tiếp nhận"
            className="grid gap-1.5"
          >
            {RECEPTION_DEPARTMENTS.map((department) => {
              const active = department.id === form.departmentId;
              return (
                <button
                  key={department.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => selectDepartment(department.id)}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600"
                      : "border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-xs font-bold ${
                        active ? "text-teal-800" : "text-slate-800"
                      }`}
                    >
                      {department.shortName}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {department.name}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      active
                        ? "bg-teal-600 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {department.ticketPrefix}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.departmentId && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-600">
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              {errors.departmentId}
            </p>
          )}
          {activeDepartment && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Phòng khám trong khoa: {activeDepartment.roomRange} &middot; Số phiếu
              sẽ bắt đầu bằng{" "}
              <span className="font-mono font-bold text-slate-700">
                {activeDepartment.ticketPrefix}
              </span>
            </p>
          )}
        </div>

        <div>
          <FormField
            label="Ngày khám"
            htmlFor="intake-appointmentDate"
            error={errors.appointmentDate}
            required
          >
            <div className="relative">
              <CalendarDays
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <select
                id="intake-appointmentDate"
                className={`${controlClass(Boolean(errors.appointmentDate))} pl-8`}
                value={form.appointmentDate}
                onChange={(event) => {
                  onChange("appointmentDate", event.target.value);
                  onChange("slotStartTime", "");
                }}
              >
                {dateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </FormField>

          {isOffline && (
            <p className="mt-1 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-800">
              <WifiOff className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                Không kết nối được PatientIntakeService. Đang hiển thị lịch khám
                mô phỏng - vui lòng kiểm tra backend tại cổng 8082.
              </span>
            </p>
          )}
          {!isOffline && loadError && (
            <p className="mt-1 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] leading-relaxed text-red-700">
              <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{loadError}</span>
            </p>
          )}
          {!isOffline && !loadError && (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Khung giờ đã qua trong ngày và khung giờ đã đầy sẽ bị khóa. Sức chứa
              mỗi khung là 4 lượt khám/bác sĩ.
            </p>
          )}
        </div>
      </div>

      {/* Slot grid */}
      <div id="intake-slots" className="mt-3 border-t border-slate-200/80 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Khung giờ khả dụng
            <span className="ml-0.5 text-red-500">*</span>
          </p>
          {form.slotStartTime && (
            <button
              type="button"
              onClick={() => onChange("slotStartTime", "")}
              className="text-[11px] font-semibold text-teal-700 hover:underline"
            >
              Bỏ chọn
            </button>
          )}
        </div>

        {isLoading && slots.length === 0 ? (
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="h-[52px] animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
            Không có khung giờ nào được mở cho chuyên khoa này. Vui lòng thử
            ngày khác.
          </p>
        ) : (
          <div className="space-y-2.5">
            {grouped.map(([label, blockSlots]) => (
              <div key={label}>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {blockSlots.map((slot) => {
                    const past = isPastSlot(slot, form.appointmentDate);
                    const disabled = !slot.isAvailable || past;
                    const active = form.slotStartTime === slot.startTime;
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        disabled={disabled}
                        aria-pressed={active}
                        onClick={() => {
                          onChange("slotStartTime", slot.startTime);
                          onSlotSelected?.();
                        }}
                        className={`rounded-lg border px-1.5 py-1.5 text-center transition-colors ${
                          active
                            ? "border-teal-600 bg-teal-600 text-white ring-1 ring-teal-600"
                            : disabled
                              ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                              : "border-slate-300 bg-white text-slate-700 hover:border-teal-400 hover:bg-teal-50"
                        }`}
                      >
                        <span className="block font-mono text-xs font-bold leading-tight">
                          {slot.startTime.slice(0, 5)}
                        </span>
                        <span
                          className={`block text-[9px] leading-tight ${
                            active ? "text-teal-100" : "text-slate-400"
                          }`}
                        >
                          {past
                            ? "Đã qua"
                            : `${slot.availableCapacity}/${slot.totalCapacity} chỗ`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-1 min-h-[14px] text-[11px] font-medium text-red-600">
          {errors.slotStartTime ?? "\u00a0"}
        </p>
      </div>
    </section>
  );
}
