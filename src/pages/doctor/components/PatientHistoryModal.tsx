import { FileText, X } from "lucide-react";
import type { PatientRecord } from "../data/doctorMockData";

interface PatientHistoryModalProps {
  open: boolean;
  onClose: () => void;
  patient: PatientRecord | null;
}

export default function PatientHistoryModal({
  open,
  onClose,
  patient,
}: PatientHistoryModalProps) {
  if (!open || !patient) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Lịch sử bệnh án bệnh nhân"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Đóng lịch sử bệnh án"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40"
      />

      {/* Slide-over panel */}
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-surface-light shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {patient.name}
            </p>
            <p className="text-xs text-slate-500">
              {patient.patientId}
              {patient.age > 0 && ` · ${patient.age} tuổi`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng điều khiển"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* Past consultations */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Lịch sử khám bệnh ({patient.pastEncounters.length})
            </h3>
            <div className="mt-2 space-y-2">
              {patient.pastEncounters.length === 0 && (
                <p className="text-xs text-slate-400">
                  Chưa có lần khám trước nào trong hồ sơ này.
                </p>
              )}
              {patient.pastEncounters.map((encounter) => (
                <article
                  key={encounter.id}
                  className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-medium text-slate-500">
                      {encounter.id}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {encounter.date}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {encounter.complaint}
                  </p>
                  <p className="text-xs font-medium text-teal-700">
                    {encounter.diagnosis}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {encounter.notes}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* Lab reports */}
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
              <FileText className="h-3.5 w-3.5" />
              Đơn thuốc cũ (OCR) ({patient.scannedOldPrescriptions.length})
            </h3>
            <div className="mt-2 space-y-2">
              {patient.scannedOldPrescriptions.length === 0 && (
                <p className="text-xs text-slate-400">
                  Không có đơn thuốc cũ nào được quét.
                </p>
              )}
              {patient.scannedOldPrescriptions.map((rx) => (
                <article
                  key={rx.id}
                  className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-medium text-slate-500">
                      {rx.id}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {rx.date}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {rx.medication}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                    {rx.dosage} &middot; OCR {rx.ocrConfidence}%
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* Lab reports */}
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
              <FileText className="h-3.5 w-3.5" />
              Kết quả xét nghiệm ({patient.labReports.length})
            </h3>
            <div className="mt-2 space-y-2">
              {patient.labReports.length === 0 && (
                <p className="text-xs text-slate-400">
                  Chưa có kết quả xét nghiệm nào trong hồ sơ.
                </p>
              )}
              {patient.labReports.map((lab) => (
                <article
                  key={lab.id}
                  className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-medium text-slate-500">
                      {lab.id}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        lab.status === "Normal"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : lab.status === "Abnormal"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {lab.status === "Normal"
                        ? "Bình thường"
                        : lab.status === "Abnormal"
                          ? "Bất thường"
                          : "Đang chờ"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    {lab.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {lab.result} &middot; {lab.date}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}