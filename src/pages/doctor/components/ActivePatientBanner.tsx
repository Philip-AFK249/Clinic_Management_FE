import { useState, type FormEvent } from "react";
import { AlertTriangle, FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  updateTicketVitalsApi,
} from "../../../services/intakeApi";
import type {
  QueueTicketDetailResponse,
  UpdateVitalsPayload,
} from "../../../services/intakeApi";
import type { Allergy, PatientRecord } from "../data/doctorMockData";

/** The reading the room just saved, forwarded to the encounter sign-off. */
export interface SavedVitals {
  bloodPressure: string;
  heartRate?: number;
  temperature?: string;
  spo2?: number;
}

interface ActivePatientBannerProps {
  patient: PatientRecord;
  /**
   * The ticket as PatientIntakeService holds it, including the vitals taken
   * in this room. Preferred over `patient.vitals`: it is pulled the moment the
   * patient is called and re-pulled on every queue poll, so it is the freshest
   * copy in the room.
   */
  ticketDetail?: QueueTicketDetailResponse | null;
  onOpenHistory: () => void;
  onVitalsSaved?: (vitals: SavedVitals) => void;
}

interface InRoomVitalsProps {
  ticket: QueueTicketDetailResponse;
  onSaved?: (vitals: SavedVitals) => void;
}

type VitalsForm = {
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  spo2: string;
};

/** Vitals captured where the patient actually is: the examination room. */
function InRoomVitals({ ticket, onSaved }: InRoomVitalsProps) {
  const [form, setForm] = useState<VitalsForm>({
    bloodPressure: ticket.bloodPressure ?? "",
    heartRate: ticket.heartRate ? String(ticket.heartRate) : "",
    temperature: ticket.temperature ?? "",
    spo2: ticket.spo2 ? String(ticket.spo2) : "",
  });
  const [saving, setSaving] = useState(false);

  function update(field: keyof VitalsForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    const bp = form.bloodPressure.trim().replace(/\s+/g, "");
    const heartRate = Number(form.heartRate);
    const temperature = form.temperature.trim().replace(",", ".");
    const spo2 = Number(form.spo2);

    if (!/^\d{2,3}\/\d{2,3}$/.test(bp)) {
      toast.error("Huyết áp phải có dạng 120/80.");
      return;
    }
    if (!Number.isFinite(heartRate) || heartRate < 30 || heartRate > 220) {
      toast.error("Mạch phải nằm trong khoảng 30 - 220 ck/p.");
      return;
    }
    const tempValue = Number(temperature);
    if (!temperature || !Number.isFinite(tempValue) || tempValue < 30 || tempValue > 45) {
      toast.error("Nhiệt độ phải nằm trong khoảng 30 - 45 °C.");
      return;
    }
    if (!Number.isFinite(spo2) || spo2 < 50 || spo2 > 100) {
      toast.error("SpO2 phải nằm trong khoảng 50 - 100%.");
      return;
    }

    const payload: UpdateVitalsPayload = {
      bloodPressure: bp,
      heartRate,
      temperature,
      spo2,
    };
    setSaving(true);
    try {
      const saved = await updateTicketVitalsApi(ticket.ticketNumber, payload);
      const vitals: SavedVitals = {
        bloodPressure: saved.bloodPressure?.trim() || bp,
        heartRate: saved.heartRate ?? heartRate,
        temperature: saved.temperature?.trim() || temperature,
        spo2: saved.spo2 ?? spo2,
      };
      onSaved?.(vitals);
      setForm({
        bloodPressure: vitals.bloodPressure,
        heartRate: String(vitals.heartRate ?? heartRate),
        temperature: vitals.temperature ?? temperature,
        spo2: String(vitals.spo2 ?? spo2),
      });
      toast.success(`Đã lưu sinh hiệu tại phòng khám cho phiếu ${ticket.ticketNumber}.`);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Không lưu được sinh hiệu. Vui lòng thử lại.",
      );
    } finally {
      setSaving(false);
    }
  }

  const fields: { key: keyof VitalsForm; label: string; unit: string; placeholder: string }[] = [
    { key: "bloodPressure", label: "Huyết áp", unit: "mmHg", placeholder: "120/80" },
    { key: "heartRate", label: "Mạch (ck/p)", unit: "", placeholder: "80" },
    { key: "temperature", label: "Nhiệt độ (°C)", unit: "", placeholder: "36.5" },
    { key: "spo2", label: "SpO2 (%)", unit: "", placeholder: "98" },
  ];

  return (
    <form
      onSubmit={(event) => void handleSave(event)}
      className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap"
    >
      {fields.map((field) => (
        <label key={field.key} className="block min-w-0">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {field.label}
          </span>
          <span className="flex items-center gap-1">
            <input
              type="text"
              inputMode={field.key === "bloodPressure" ? "text" : "decimal"}
              value={form[field.key]}
              onChange={(event) => update(field.key, event.target.value)}
              placeholder={field.placeholder}
              aria-label={field.label}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none transition-colors focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 sm:h-8 sm:w-[76px]"
            />
            {field.unit && <span className="text-[10px] text-slate-400">{field.unit}</span>}
          </span>
        </label>
      ))}
      <button
        type="submit"
        disabled={saving}
        className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-teal-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1 sm:h-8"
      >
        {saving ? (
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        ) : (
          <Save size={12} aria-hidden="true" />
        )}
        {saving ? "Đang lưu..." : "Lưu sinh hiệu"}
      </button>
    </form>
  );
}

function AllergyBadge({ allergy }: { allergy: Allergy }) {
  const severe = allergy.severity === "SEVERE";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${severe
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
  onVitalsSaved,
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
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200/80 bg-white px-3 py-2.5 sm:px-4">
      {/* Demographics */}
      <div className="w-full min-w-0 flex-1 lg:min-w-[280px]">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="max-w-full min-w-0 break-words text-base font-bold text-slate-900">
            {patient.name}
          </h2>
          <span className="whitespace-nowrap text-xs font-medium text-slate-500">
            {patient.age > 0 ? `${patient.age} tuổi` : "Chưa rõ tuổi"},{" "}
            {patient.gender}
          </span>
          <span className="whitespace-nowrap text-xs font-semibold text-teal-700">
            Số phiếu: {patient.ticketNumber}
          </span>
        </div>
        <p className="mt-0.5 break-words text-xs text-slate-500">
          ID Bệnh nhân:{" "}
          <span className="font-mono font-medium text-slate-700">
            {patient.patientId}
          </span>{" "}
          &middot; Ngày sinh: {patient.dob}
        </p>

        {/* BHYT verification */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {patient.isOcrVerified ? (
            <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
              Thẻ BHYT Hợp lệ (OCR) - {patient.insuranceCode}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              Chưa có thẻ BHYT OCR
            </span>
          )}
          <span className="whitespace-nowrap text-[11px] text-slate-500">
            Nơi KCB: {patient.initialHospitalCode}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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

        <p className="mt-1 text-xs leading-relaxed text-slate-700">
          <span className="font-semibold uppercase tracking-wide text-slate-400">
            Lý do vào viện (AI Triage):{" "}
          </span>
          {patient.chiefComplaint}
        </p>
      </div>

      {/* Vitals are measured and edited right here in the exam room. */}
      <div className="w-full min-w-0 flex-1 border-t border-slate-200/80 pt-2 lg:w-auto lg:border-x lg:border-t-0 lg:px-4 lg:pt-0">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-teal-700">
          Sinh hiệu tại phòng khám (BS &amp; Y tá nhập trực tiếp)
        </p>
        {ticketDetail ? (
          <InRoomVitals
            key={ticketDetail.ticketNumber}
            ticket={ticketDetail}
            onSaved={onVitalsSaved}
          />
        ) : patient.vitalsRecorded === false ? (
          <div className="flex h-9 items-center gap-2">
            <span className="text-xs text-slate-400">Chưa có chỉ số sinh hiệu</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:h-8 sm:items-center sm:gap-5">
            <Vital label="Huyết áp" value={patient.vitals.bp} unit="mmHg" />
            <Vital label="Mạch" value={String(patient.vitals.hr)} unit="ck/p" />
            <Vital label="Nhiệt độ" value={patient.vitals.temp} unit="°C" />
            <Vital label="SpO2" value={String(patient.vitals.spo2)} unit="%" />
          </div>
        )}
      </div>

      {/* Multi-specialty alert + OCR/EHR history trigger */}
      <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end sm:gap-1.5">
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
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-center text-[11px] font-bold leading-snug text-amber-900 shadow-sm transition-colors hover:border-amber-400 hover:bg-amber-100 sm:w-auto sm:justify-start sm:text-right"
            >
              🩺 Đa khối: Bệnh nhân có triệu chứng kèm tại{" "}
              {multiSpecialty.secondaryDepartmentName ?? "khối khác"}
            </button>

            {showMultiSpecialtyNote && (
              <div
                id="multi-specialty-note"
                role="tooltip"
                className="absolute right-0 top-full z-30 mt-1.5 w-[min(20rem,calc(100vw_-_2rem))] rounded-xl border border-amber-200 bg-white p-3 text-left shadow-elevated"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                  Tư vấn đa khối
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  {multiSpecialty.multiSpecialtyNote ||
                    "Bệnh nhân có triệu chứng kèm theo ở khối khác."}
                </p>
                <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-500">
                  Cân nhắc xử lý ngay triệu chứng kèm hoặc chỉ định hội chẩn
                  liên khoa với{" "}
                  {multiSpecialty.secondaryDepartmentName ?? "khối đó"}{" "}
                  trong lần khám này.
                </p>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onOpenHistory}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-left text-xs font-semibold leading-snug text-slate-700 shadow-sm transition-colors hover:border-teal-300 hover:text-teal-700 sm:w-auto sm:whitespace-nowrap"
        >
          <FileText className="h-4 w-4 text-teal-600" aria-hidden="true" />
          Xem Hồ sơ Bệnh án &amp; Đơn thuốc OCR ({patient.pastEncounters.length} lần khám trước)
        </button>
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