import { AlertTriangle, Bot, CheckSquare, Sparkles } from "lucide-react";
import type {
  TriagePriority,
  TriageSuggestion,
} from "../data/patientMockRecords";

/**
 * Multi-organ routing, normalised from whichever surface produced it (the
 * voice gateway's snake_case verdict, the kiosk's symptom row).
 *
 * Kept camelCase here so the card does not care where the data came from - it
 * only has to say which khoa the patient is booked into and which one to visit
 * alongside it.
 */
export interface MultiSpecialtyAdvisory {
  /** The khoa the appointment was actually booked into. */
  primaryDepartmentName: string;
  /** The co-consult clinic the patient is asked to visit as well. */
  secondaryDepartmentName: string;
  /** The clinical advisory from the triage model, shown as a note. */
  note?: string | null;
}

interface TriageResultCardProps {
  suggestion: TriageSuggestion | null;
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
  /**
   * Present only for a multi-organ complaint. The card renders for it alone -
   * a voice verdict with a secondary department needs its alert above the slot
   * selector even though the keyword suggestion is not in play.
   */
  multiSpecialty?: MultiSpecialtyAdvisory | null;
}

const PRIORITY_STYLES: Record<
  TriagePriority,
  { pill: string; dot: string }
> = {
  P1: {
    pill: "border border-triage-p1/20 bg-triage-p1-bg text-triage-p1",
    dot: "bg-triage-p1",
  },
  P2: {
    pill: "border border-triage-p2/20 bg-triage-p2-bg text-triage-p2",
    dot: "bg-triage-p2",
  },
  P3: {
    pill: "border border-triage-p3/20 bg-triage-p3-bg text-triage-p3",
    dot: "bg-triage-p3",
  },
};

export default function TriageResultCard({
  suggestion,
  acknowledged,
  onAcknowledge,
  multiSpecialty = null,
}: TriageResultCardProps) {
  if (!suggestion && !multiSpecialty) return null;

  const priorityStyle = suggestion ? PRIORITY_STYLES[suggestion.priority] : null;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        <Sparkles className="h-4 w-4 text-clinical-600" aria-hidden="true" />
        Gợi ý phân luồng Y khoa (AI Triage)
      </p>

      {/* Multi-organ alert - deliberately the first thing under the header so
          it sits above the booking slot selector whatever renders below. */}
      {multiSpecialty && (
        <div className="space-y-2">
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-sky-50 p-3 shadow-sm"
          >
            <span className="text-lg leading-none" aria-hidden="true">
              ⚠️
            </span>
            <p className="text-sm font-bold leading-relaxed text-amber-900">
              Phát hiện triệu chứng đa cơ quan: Hệ thống đã ưu tiên xếp khám tại{" "}
              {multiSpecialty.primaryDepartmentName} (Mức độ khẩn). Đề xuất khám
              kèm:{" "}
              <span className="font-extrabold text-sky-800 underline decoration-sky-300 underline-offset-2">
                {multiSpecialty.secondaryDepartmentName}
              </span>
              .
            </p>
          </div>

          {multiSpecialty.note && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
                Tư vấn lâm sàng đa chuyên khoa
              </p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-sky-900">
                {multiSpecialty.note}
              </p>
            </div>
          )}
        </div>
      )}

      {suggestion && priorityStyle && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Chuyên khoa đề xuất
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {suggestion.department}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Mức độ ưu tiên
              </p>
              <span
                className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold ${priorityStyle.pill}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${priorityStyle.dot}`}
                  aria-hidden="true"
                />
                {suggestion.priorityLabel}
              </span>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Độ tin cậy mô hình
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <Bot className="h-4 w-4 text-clinical-600" aria-hidden="true" />
                {suggestion.confidence}%{" "}
                <span className="font-medium text-slate-400">
                  (Động cơ AI Y khoa)
                </span>
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-600">
            {suggestion.summary}
          </p>
        </>
      )}

      {/* Mandatory ethical medical disclaimer */}
      {suggestion && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="h-5 w-5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-bold text-amber-900">
                Tuyên bố Miễn trừ Trách nhiệm Y tế
              </p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900">
                Đánh giá tự động này chỉ là công cụ hỗ trợ phân luồng hành chính,
                KHÔNG phải chẩn đoán y khoa hay tư vấn lâm sàng. Trong trường hợp
                khó thở cấp tính hoặc cấp cứu nguy hiểm, hãy gọi ngay 115 hoặc
                đến khoa cấp cứu gần nhất.
              </p>
            </div>
          </div>

          <label
            htmlFor="triage-ack"
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-white p-3"
          >
            <input
              id="triage-ack"
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => onAcknowledge(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-amber-300 text-clinical-600 focus:ring-clinical-500"
            />
            <span className="flex items-start gap-2 text-sm font-medium text-slate-700">
              <CheckSquare className="h-4 w-4 shrink-0 text-clinical-600" aria-hidden="true" />
              Tôi đã đọc và xác nhận rằng gợi ý phân luồng này không thay thế cho
              chẩn đoán của bác sĩ.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}