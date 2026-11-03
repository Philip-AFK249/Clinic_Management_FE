import { FileText, X } from "lucide-react";
import type { PatientEncounterDto } from "../../../services/clinicalApi";
import type { PatientRecord } from "../data/doctorMockData";
import { formatEncounterDate } from "../data/encounterMapper";

interface PatientHistoryModalProps {
  open: boolean;
  onClose: () => void;
  patient: PatientRecord | null;
  /**
   * A single signed encounter selected from the "Lịch sử đã khám" tab. When
   * present the modal shows that visit's SOAP / ICD-10 / vitals instead of the
   * active patient's OCR history.
   */
  encounter?: PatientEncounterDto | null;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: {
    label: "Đang khám",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  COMPLETED: {
    label: "Hoàn tất",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

function SoapSection({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
        {value?.trim() || "Chưa ghi nhận."}
      </p>
    </div>
  );
}

function Vital({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm font-bold text-slate-900">
        {value}
        {unit && value !== "--" && (
          <span className="ml-0.5 text-xs font-medium text-slate-500">{unit}</span>
        )}
      </p>
    </div>
  );
}

function EncounterDetail({ encounter }: { encounter: PatientEncounterDto }) {
  const status = STATUS_LABEL[encounter.status] ?? STATUS_LABEL.COMPLETED;
  const diagnoses = encounter.diagnoses ?? [];

  return (
    <div className="space-y-5">
      {/* Encounter summary */}
      <section className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold text-slate-600">
            {encounter.ticketNumber}
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            {formatEncounterDate(encounter)}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}
          >
            {status.label}
          </span>
          {diagnoses.length === 0 ? (
            <span className="text-[11px] text-slate-400">
              Chưa có chẩn đoán ICD-10
            </span>
          ) : (
            diagnoses.map((diagnosis) => (
              <span
                key={`${diagnosis.icd10Code}-${diagnosis.diseaseName}`}
                className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700"
              >
                {diagnosis.icd10Code} - {diagnosis.diseaseName}
                {diagnosis.isPrimary ? " (chính)" : ""}
              </span>
            ))
          )}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Bác sĩ điều trị:{" "}
          <span className="font-semibold text-slate-800">
            {encounter.doctorName}
          </span>
        </p>
      </section>

      {/* Vitals */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Dấu hiệu sinh tồn
        </h3>
        <div className="mt-2 grid grid-cols-4 gap-3 rounded-lg border border-slate-200/80 bg-white p-3 shadow-card">
          <Vital
            label="Huyết áp"
            value={encounter.bloodPressure || "--"}
            unit="mmHg"
          />
          <Vital
            label="Mạch"
            value={
              encounter.heartRate !== null && encounter.heartRate !== undefined
                ? String(encounter.heartRate)
                : "--"
            }
            unit="bpm"
          />
          <Vital
            label="Nhiệt độ"
            value={encounter.temperature || "--"}
            unit="°C"
          />
          <Vital
            label="SpO2"
            value={
              encounter.spo2 !== null && encounter.spo2 !== undefined
                ? String(encounter.spo2)
                : "--"
            }
            unit="%"
          />
        </div>
      </section>

      {/* SOAP */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Bệnh án SOAP
        </h3>
        <div className="mt-2 space-y-2">
          <SoapSection label="S — Chủ quan" value={encounter.subjective} />
          <SoapSection label="O — Khách quan" value={encounter.objective} />
          <SoapSection label="A — Đánh giá" value={encounter.assessment} />
          <SoapSection label="P — Kế hoạch" value={encounter.plan} />
        </div>
      </section>

      {/* Prescription */}
      <section>
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
          <FileText className="h-3.5 w-3.5" />
          Đơn thuốc
        </h3>
        <div className="mt-2 rounded-lg border border-slate-200/80 bg-white p-3 shadow-card">
          {encounter.prescriptionId ? (
            <p className="text-xs font-medium text-slate-700">
              Đơn thuốc #{encounter.prescriptionId} đã được tạo cho ca khám này.
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              Lịch sử ca khám không kèm chi tiết đơn thuốc.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default function PatientHistoryModal({
  open,
  onClose,
  patient,
  encounter,
}: PatientHistoryModalProps) {
  if (!open || (!patient && !encounter)) return null;

  const title = encounter?.patientName ?? patient?.name ?? "Bệnh án";

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
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">
              {encounter
                ? `${encounter.ticketNumber} · ${formatEncounterDate(encounter)}`
                : [
                    patient?.patientId,
                    patient && patient.age > 0 ? `${patient.age} tuổi` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
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
          {encounter ? (
            <EncounterDetail encounter={encounter} />
          ) : (
            patient && (
              <>
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
                    {patient.pastEncounters.map((pastEncounter) => (
                      <article
                        key={pastEncounter.id}
                        className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-medium text-slate-500">
                            {pastEncounter.id}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {pastEncounter.date}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {pastEncounter.complaint}
                        </p>
                        <p className="text-xs font-medium text-teal-700">
                          {pastEncounter.diagnosis}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          {pastEncounter.notes}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                {/* Old prescriptions */}
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
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
