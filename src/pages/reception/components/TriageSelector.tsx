import { Stethoscope } from "lucide-react";
import { controlClass } from "../formStyles";
import type { IntakeErrors, IntakeFormState } from "../hooks/useIntakeForm";
import { TRIAGE_OPTIONS } from "../data/receptionMockData";
import type { TriagePriority } from "../../../services/intakeApi";

const COMPLAINT_CHAR_LIMIT = 500;

interface TriageSelectorProps {
  form: IntakeFormState;
  errors: IntakeErrors;
  onChange: <K extends keyof IntakeFormState>(
    field: K,
    value: IntakeFormState[K],
  ) => void;
}

export default function TriageSelector({
  form,
  errors,
  onChange,
}: TriageSelectorProps) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Stethoscope className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold leading-tight text-slate-900">
            Phân Loại Triệu Chứng &amp; Mức Độ Ưu Tiên
          </h2>
          <p className="text-[11px] text-slate-500">
            Quyết định thứ tự xếp hàng tại phòng khám
          </p>
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <label
            htmlFor="intake-chiefComplaint"
            className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
          >
            Lý do vào viện / triệu chứng chính
            <span className="ml-0.5 text-red-500">*</span>
          </label>
          <span className="text-[10px] tabular-nums text-slate-400">
            {form.chiefComplaint.length}/{COMPLAINT_CHAR_LIMIT}
          </span>
        </div>
        <textarea
          id="intake-chiefComplaint"
          rows={3}
          maxLength={COMPLAINT_CHAR_LIMIT}
          className={`${controlClass(Boolean(errors.chiefComplaint))} h-auto resize-y py-2 leading-relaxed`}
          placeholder="Ví dụ: Sốt cao 38.5°C, nuốt đau rát họng 2 ngày nay, khó nuốt nước..."
          value={form.chiefComplaint}
          onChange={(event) => onChange("chiefComplaint", event.target.value)}
        />
        <p
          role={errors.chiefComplaint ? "alert" : undefined}
          className="mt-1 min-h-[14px] text-[11px] leading-[14px]"
        >
          {errors.chiefComplaint ? (
            <span className="font-medium text-red-600">
              {errors.chiefComplaint}
            </span>
          ) : (
            <span className="text-slate-400">
              Bác sĩ sẽ đọc nội dung này ngay khi bệnh nhân vào phòng.
            </span>
          )}
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Mức độ ưu tiên Triage
          <span className="ml-0.5 text-red-500">*</span>
        </p>
        <div
          id="intake-triage"
          role="radiogroup"
          aria-label="Chọn mức độ ưu tiên triage"
          className="grid gap-1.5 sm:grid-cols-3"
        >
          {TRIAGE_OPTIONS.map((option) => {
            const active = form.priorityLevel === option.level;
            return (
              <button
                key={option.level}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange("priorityLevel", option.level as TriagePriority)}
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  active
                    ? option.cardClass
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${option.dotClass} ${
                      active ? "animate-pulse-dot" : ""
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-bold">{option.label}</span>
                </span>
                <span
                  className={`mt-1 block text-[10px] leading-snug ${
                    active ? "opacity-90" : "text-slate-500"
                  }`}
                >
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1 min-h-[14px] text-[11px] font-medium text-red-600">
          {errors.priorityLevel ?? "\u00a0"}
        </p>
      </div>
    </section>
  );
}
