import { useState } from "react";
import { AlertTriangle, Printer } from "lucide-react";
import type { SymptomOption } from "../data/kioskMockData";
import { SYMPTOM_OPTIONS } from "../data/kioskMockData";

interface KioskSymptomTriageStepProps {
  selectedSymptom: SymptomOption | null;
  onSelectSymptom: (symptom: SymptomOption) => void;
  onPrint: () => void;
}

const TRIAGE_STYLES: Record<SymptomOption["triage"], string> = {
  P1: "border-red-200 bg-red-50 text-red-700",
  P2: "border-amber-200 bg-amber-50 text-amber-700",
  P3: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default function KioskSymptomTriageStep({
  selectedSymptom,
  onSelectSymptom,
  onPrint,
}: KioskSymptomTriageStepProps) {
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-8">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Chọn Triệu Chứng Chính Hoặc Lý Do Đến Khám
      </h1>
      <p className="mt-2 text-base text-slate-500">
        Chạm vào một ô bên dưới. Hệ thống tự động phân luồng tới khoa khám phù
        hợp với mức ưu tiên.
      </p>

      {/* Symptom grid */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {SYMPTOM_OPTIONS.map((option) => {
          const selected = selectedSymptom?.id === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectSymptom(option)}
              className={`flex min-h-20 flex-col items-start gap-2 rounded-xl border-2 bg-white p-4 text-left shadow-card transition-all active:scale-95 ${
                selected
                  ? option.isEmergency
                    ? "border-red-500 ring-2 ring-red-200"
                    : "border-clinical-500 ring-2 ring-clinical-200"
                  : "border-slate-200/80 hover:border-slate-300"
              }`}
            >
              <span className="flex w-full items-center justify-between">
                <span className="text-3xl" aria-hidden="true">
                  {option.icon}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-bold ${TRIAGE_STYLES[option.triage]}`}
                >
                  {option.isEmergency
                    ? "P1 - KHẨN CẤP"
                    : option.triage === "P2"
                      ? "P2 - CẦN KHÁM SỚM"
                      : "P3 - THƯỜNG"}
                </span>
              </span>
              <span className="mt-auto text-base font-semibold leading-snug text-slate-900">
                {option.label}
              </span>
              <span className="text-xs text-slate-500">
                {option.department} ({option.room})
              </span>
            </button>
          );
        })}
      </div>

      {/* Multi-organ alert - above the routing suggestion (and therefore above
          the print action) exactly as the booking card puts it above the slot
          selector. */}
      {selectedSymptom?.secondaryDepartmentId && (
        <div className="mt-6 space-y-3">
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-sky-50 p-4 shadow-card"
          >
            <span className="text-2xl leading-none" aria-hidden="true">
              ⚠️
            </span>
            <p className="text-base font-bold leading-relaxed text-amber-900">
              Phát hiện triệu chứng đa cơ quan: Hệ thống đã ưu tiên xếp khám tại{" "}
              {selectedSymptom.department} (Mức độ khẩn). Đề xuất khám kèm:{" "}
              <span className="font-extrabold text-sky-800 underline decoration-sky-300 underline-offset-2">
                {selectedSymptom.secondaryDepartmentName}
              </span>
              .
            </p>
          </div>

          {selectedSymptom.multiSpecialtyNote && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
                Tư vấn lâm sàng đa chuyên khoa
              </p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-sky-900">
                {selectedSymptom.multiSpecialtyNote}
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI routing suggestion */}
      {selectedSymptom !== null && (
        <div
          className={`mt-6 rounded-2xl border-2 p-4 ${
            selectedSymptom.isEmergency
              ? "border-red-200 bg-red-50"
              : "border-clinical-200 bg-clinical-50"
          }`}
        >
          <p className="text-sm font-bold text-slate-900">
            {selectedSymptom.isEmergency ? "🚨 Luồng cấp cứu khẩn cấp" : "🤖 Gợi ý phân luồng"}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {selectedSymptom.department} • {selectedSymptom.room} | Độ ưu tiên:{" "}
            <span className="font-bold">{selectedSymptom.priorityLabel}</span>
          </p>
        </div>
      )}

      {/* Mandatory ethical disclaimer */}
      <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="h-8 w-8 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <p className="text-sm font-bold leading-relaxed text-amber-800">
            CẢNH BÁO Y TẾ: Gợi ý phân luồng phòng khám của Kiosk chỉ mang tính
            chất định hướng vị trí tiếp đón ban đầu, hoàn toàn KHÔNG thay thế
            chẩn đoán y khoa của Bác sĩ.
          </p>
        </div>
        <label className="mt-4 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-amber-300 bg-white px-4 py-3 transition-transform active:scale-95">
          <input
            type="checkbox"
            checked={disclaimerChecked}
            onChange={(e) => setDisclaimerChecked(e.target.checked)}
            className="h-6 w-6 rounded text-amber-600 focus:ring-amber-500"
          />
          <span className="text-sm font-semibold text-slate-800">
            Tôi xác nhận đã hiểu rõ thông tin này và đồng ý in số thứ tự khám
          </span>
        </label>
      </div>

      <button
        type="button"
        onClick={onPrint}
        disabled={!selectedSymptom || !disclaimerChecked}
        className="mt-6 inline-flex h-16 w-full items-center justify-center gap-3 rounded-xl bg-clinical-600 text-lg font-bold text-white shadow-md transition-all hover:bg-clinical-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
      >
        <Printer className="h-6 w-6" aria-hidden="true" />
        🖨️ In Phiếu Số Thứ Tự
      </button>
    </div>
  );
}