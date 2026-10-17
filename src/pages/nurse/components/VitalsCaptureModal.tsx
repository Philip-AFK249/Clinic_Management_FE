import { useMemo, useState, type FormEvent } from "react";
import { Activity, HeartPulse, Loader2, Thermometer, Wind, X } from "lucide-react";
import type { QueueTicket } from "../../../services/intakeApi";
import type { VitalsRecord } from "../data/nurseStation";

interface VitalsCaptureModalProps {
  ticket: QueueTicket;
  existing?: VitalsRecord;
  nurseName: string;
  onClose: () => void;
  onSave: (record: VitalsRecord) => void;
}

type VitalsForm = {
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  spo2: string;
};

type VitalsErrors = Partial<Record<keyof VitalsForm, string>>;

function formFrom(record: VitalsRecord | undefined): VitalsForm {
  return {
    bloodPressure: record?.bloodPressure ?? "",
    heartRate: record?.heartRate ? String(record.heartRate) : "",
    temperature: record?.temperature ?? "",
    spo2: record?.spo2 ? String(record.spo2) : "",
  };
}

/**
 * Bedside vitals capture. There is no write endpoint for these yet, so the
 * reading is held on the nurse's session (pre-filled on a re-open) and the UI
 * says so rather than implying it reached the bệnh án.
 */
export default function VitalsCaptureModal({
  ticket,
  existing,
  nurseName,
  onClose,
  onSave,
}: VitalsCaptureModalProps) {
  const [form, setForm] = useState<VitalsForm>(() => formFrom(existing));
  const [errors, setErrors] = useState<VitalsErrors>({});
  const [saving, setSaving] = useState(false);

  const patientName = useMemo(
    () => ticket.patient?.fullName ?? "Không rõ họ tên",
    [ticket.patient?.fullName],
  );

  function update(field: keyof VitalsForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate(): VitalsErrors {
    const next: VitalsErrors = {};
    const bp = form.bloodPressure.trim();
    if (!bp) {
      next.bloodPressure = "Nhập huyết áp, ví dụ 120/80.";
    } else if (!/^\d{2,3}\s*\/\s*\d{2,3}$/.test(bp)) {
      next.bloodPressure = "Định dạng đúng là tâm thu/tâm trương (120/80).";
    }

    const hr = Number(form.heartRate);
    if (!form.heartRate.trim()) {
      next.heartRate = "Nhập số lần/phút.";
    } else if (!Number.isFinite(hr) || hr < 30 || hr > 220) {
      next.heartRate = "Mạch phải trong khoảng 30 - 220 lần/phút.";
    }

    const temp = Number(form.temperature);
    if (!form.temperature.trim()) {
      next.temperature = "Nhập nhiệt độ, ví dụ 36.7.";
    } else if (!Number.isFinite(temp) || temp < 30 || temp > 45) {
      next.temperature = "Nhiệt độ phải trong khoảng 30 - 45 °C.";
    }

    const spo2 = Number(form.spo2);
    if (!form.spo2.trim()) {
      next.spo2 = "Nhập SpO2, ví dụ 98.";
    } else if (!Number.isFinite(spo2) || spo2 < 50 || spo2 > 100) {
      next.spo2 = "SpO2 phải trong khoảng 50 - 100%.";
    }

    return next;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSaving(true);
    try {
      onSave({
        ticketNumber: ticket.ticketNumber,
        patientName,
        bloodPressure: form.bloodPressure.trim().replace(/\s+/g, ""),
        heartRate: Number(form.heartRate),
        temperature: form.temperature.trim(),
        spo2: Number(form.spo2),
        recordedAt: new Date().toISOString(),
        recordedBy: nurseName,
      });
    } finally {
      setSaving(false);
    }
  }

  const fields: {
    key: keyof VitalsForm;
    label: string;
    unit: string;
    placeholder: string;
    icon: typeof Activity;
    type?: string;
  }[] = [
    { key: "bloodPressure", label: "Huyết áp", unit: "mmHg", placeholder: "120/80", icon: Activity },
    { key: "heartRate", label: "Mạch", unit: "lần/phút", placeholder: "78", icon: HeartPulse, type: "number" },
    { key: "temperature", label: "Nhiệt độ", unit: "°C", placeholder: "36.7", icon: Thermometer, type: "number" },
    { key: "spo2", label: "SpO2", unit: "%", placeholder: "98", icon: Wind, type: "number" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Đo sinh hiệu ${ticket.ticketNumber}`}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200/80 bg-white shadow-elevated">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">Đo Dấu Hiệu Sinh Tồn</h3>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {ticket.ticketNumber} &middot; {patientName} &middot; {ticket.roomNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            {fields.map((field) => {
              const Icon = field.icon;
              const error = errors[field.key];
              return (
                <div key={field.key}>
                  <label
                    htmlFor={`vitals-${field.key}`}
                    className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                  >
                    <Icon className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
                    {field.label}
                    <span className="font-normal text-slate-400">({field.unit})</span>
                  </label>
                  <input
                    id={`vitals-${field.key}`}
                    type={field.type ?? "text"}
                    inputMode={field.type === "number" ? "decimal" : undefined}
                    value={form[field.key]}
                    onChange={(e) => update(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    disabled={saving}
                    className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                      error
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                        : "border-slate-200 focus:border-violet-600 focus:ring-violet-500/20"
                    }`}
                  />
                  {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
                </div>
              );
            })}
          </div>

          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            Chỉ số được lưu trên phiên làm việc của điều dưỡng để bàn trực theo
            dõi; bệnh án chỉ ghi nhận sau khi bác sĩ hoàn tất khám.
          </p>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <HeartPulse size={16} aria-hidden="true" />
              )}
              {saving ? "Đang lưu..." : existing ? "Cập nhật chỉ số" : "Lưu chỉ số"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
