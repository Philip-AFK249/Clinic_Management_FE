import { useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import type { QueueTicketDetailResponse } from "../../../services/intakeApi";
import type { Allergy, PatientRecord } from "../data/doctorMockData";

interface ActivePatientBannerProps {
  patient: PatientRecord;
  /**
   * The ticket as PatientIntakeService holds it, including the vitals the
   * nurse station recorded. Preferred over `patient.vitals`: it is pulled the
   * moment the patient is called and re-pulled on every queue poll, so it is
   * the freshest copy in the room.
   */
  ticketDetail?: QueueTicketDetailResponse | null;
  onOpenHistory: () => void;
}

function AllergyBadge({ allergy }: { allergy: Allergy }) {
  const severe = allergy.severity === "SEVERE";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        severe
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      {allergy.name} - {allergy.reaction}
    </span>
  );
}

export default function ActivePatientBanner({
  patient,
  ticketDetail,
  onOpenHistory,
}: ActivePatientBannerProps) {
  /** Popover visibility for the multi-specialty advisory, hover *and* click. */
  const [showMultiSpecialtyNote, setShowMultiSpecialtyNote] = useState(false);

  /**
   * The co-consult routing on the ticket, or `null` for an ordinary
   * single-department patient - in which case nothing below renders. Keyed on
   * the id exactly as the ticket does; a missing display name still has to be
   * surfaced to the doctor rather than swallowed.
   */
  const multiSpecialty = ticketDetail?.secondaryDepartmentId
    ? ticketDetail
    : null;

  return (
    <div className="grid shrink-0 grid-cols-12 gap-3 border-b border-slate-200/80 bg-white p-3">
      {/* Demographics */}
      <div className="col-span-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold text-slate-900">{patient.name}</h2>
          <span className="text-xs font-medium text-slate-500">
            {patient.age > 0 ? `${patient.age} tuổi` : "Chưa rõ tuổi"},{" "}
            {patient.gender}
          </span>
          <span className="text-xs font-semibold text-teal-700">
            Số phiếu: {patient.ticketNumber}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          ID Bệnh nhân:{" "}
          <span className="font-mono font-medium text-slate-700">
            {patient.patientId}
          </span>{" "}
          &middot; Ngày sinh: {patient.dob}
        </p>

        {/* BHYT verification */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {patient.isOcrVerified ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
              ✓ Thẻ BHYT Hợp lệ (OCR) - {patient.insuranceCode}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              Chưa có thẻ BHYT OCR
            </span>
          )}
          <span className="text-[11px] text-slate-500">
            Nơi KCB: {patient.initialHospitalCode}
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-1.5">
          {patient.allergies.length > 0 ? (
            patient.allergies.map((allergy) => (
              <AllergyBadge key={allergy.name} allergy={allergy} />
            ))
          ) : patient.allergiesKnown === false ? (
            <span className="text-xs font-medium text-amber-700">
              Chưa có dữ liệu dị ứng trong hồ sơ - cần khai hỏi bệnh nhân
            </span>
          ) : (
            <span className="text-xs text-slate-400">Không có tiền sử dị ứng</span>
          )}
        </div>
      </div>

      {/* Vitals */}
      <div className="col-span-4 flex items-center gap-5 border-x border-slate-200/80 px-4">
        {ticketDetail ? (
          // The nurse station's own reading. Placeholders, not zeros: an
          // unmeasured vital is "unknown", never "0".
          <>
            <Vital
              label="Huyết áp"
              value={ticketDetail.bloodPressure || "--/--"}
              unit="mmHg"
            />
            <Vital
              label="Mạch"
              value={ticketDetail.heartRate ? String(ticketDetail.heartRate) : "--"}
              unit="bpm"
            />
            <Vital
              label="SpO2"
              value={ticketDetail.spo2 ? String(ticketDetail.spo2) : "--"}
              unit="%"
            />
            <Vital
              label="Nhiệt độ"
              value={ticketDetail.temperature || "--"}
              unit="°C"
            />
          </>
        ) : patient.vitalsRecorded === false ? (
          <span className="text-xs text-slate-400">
            Chưa đo sinh hiệu tại phòng tiếp đón
          </span>
        ) : (
          <>
            <Vital label="Huyết áp" value={patient.vitals.bp} unit="mmHg" />
            <Vital label="Mạch" value={String(patient.vitals.hr)} unit="ck/p" />
            <Vital label="Nhiệt độ" value={patient.vitals.temp} unit="" />
            <Vital label="SpO2" value={String(patient.vitals.spo2)} unit="%" />
          </>
        )}
      </div>

      {/* Chief complaint + multi-specialty alert + history trigger */}
      <div className="col-span-4 flex flex-col items-end justify-center gap-2">
        {multiSpecialty && (
          // Hover is bound to the wrapper so the pointer can travel into the
          // popover without it closing underneath the doctor.
          <div
            className="relative flex justify-end"
            onMouseEnter={() => setShowMultiSpecialtyNote(true)}
            onMouseLeave={() => setShowMultiSpecialtyNote(false)}
          >
            <button
              type="button"
              onClick={() => setShowMultiSpecialtyNote((open) => !open)}
              aria-expanded={showMultiSpecialtyNote}
              aria-describedby="multi-specialty-note"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-right text-[11px] font-bold leading-tight text-amber-900 shadow-sm transition-colors hover:border-amber-400 hover:bg-amber-100"
            >
              🩺 Đa chuyên khoa: Bệnh nhân có triệu chứng kèm tại{" "}
              {multiSpecialty.secondaryDepartmentName ?? "chuyên khoa khác"}
            </button>

            {showMultiSpecialtyNote && (
              <div
                id="multi-specialty-note"
                role="tooltip"
                className="absolute right-0 top-full z-30 mt-1.5 w-80 rounded-xl border border-amber-200 bg-white p-3 text-left shadow-elevated"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                  Tư vấn đa chuyên khoa
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  {multiSpecialty.multiSpecialtyNote ||
                    "Bệnh nhân có triệu chứng kèm theo ở chuyên khoa khác."}
                </p>
                <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-500">
                  Cân nhắc xử lý ngay triệu chứng kèm hoặc chỉ định hội chẩn
                  liên khoa với{" "}
                  {multiSpecialty.secondaryDepartmentName ?? "chuyên khoa đó"}{" "}
                  trong lần khám này.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <div className="max-w-xs text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Lý do vào viện (AI Triage)
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-700">
              {patient.chiefComplaint}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-teal-300 hover:text-teal-700"
          >
            <FileText className="h-4 w-4 text-teal-600" aria-hidden="true" />
            Xem Hồ sơ Bệnh án &amp; Đơn thuốc OCR ({patient.pastEncounters.length} lần khám trước)
          </button>
        </div>
      </div>
    </div>
  );
}

function Vital({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm font-bold text-slate-900">
        {value}
        {unit && <span className="ml-0.5 text-xs font-medium text-slate-500">{unit}</span>}
      </p>
    </div>
  );
}