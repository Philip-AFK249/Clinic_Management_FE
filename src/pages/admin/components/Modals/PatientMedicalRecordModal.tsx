import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  CreditCard,
  FileText,
  Loader2,
  Pill,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";
import { getPatientEncountersApi } from "../../../../services/clinicalApi";
import type {
  EncounterStatus,
  PatientEncounterDto,
} from "../../../../services/clinicalApi";
import { ClinicalApiError } from "../../../../services/clinicalApi";
import { ageFrom, genderLabel } from "../../data/patientFilters";

interface RecordPatient {
  userId: number;
  fullName: string;
  phone?: string | null;
  insuranceCode?: string | null;
  identityCardNumber?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
}

interface PatientMedicalRecordModalProps {
  open: boolean;
  onClose: () => void;
  patient: RecordPatient | null;
}

const STATUS_BADGE: Record<
  EncounterStatus,
  { label: string; className: string }
> = {
  COMPLETED: {
    label: "Hoàn tất",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  IN_PROGRESS: {
    label: "Đang khám",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

/** The four SOAP sections, in clinical order. */
const SOAP_SECTIONS = [
  { key: "subjective", letter: "S", label: "Chủ quan" },
  { key: "objective", letter: "O", label: "Khám thực thể" },
  { key: "assessment", letter: "A", label: "Đánh giá" },
  { key: "plan", letter: "P", label: "Kế hoạch" },
] as const;

/**
 * SOAP columns are documented as non-null strings, but an encounter that is still
 * `IN_PROGRESS` may legitimately carry blanks - and a jar predating the columns
 * omits them entirely. Every note is funnelled through here so a missing value
 * renders as "không có" instead of crashing the audit view.
 */
function note(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatEncounterDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function vitalsOf(encounter: PatientEncounterDto): string[] {
  const vitals: string[] = [];
  if (note(encounter.bloodPressure)) {
    vitals.push(`Huyết áp ${note(encounter.bloodPressure)} mmHg`);
  }
  if (typeof encounter.heartRate === "number") {
    vitals.push(`Mạch ${encounter.heartRate} lần/phút`);
  }
  if (note(encounter.temperature)) {
    vitals.push(`Nhiệt độ ${note(encounter.temperature)} °C`);
  }
  if (typeof encounter.spo2 === "number") {
    vitals.push(`SpO₂ ${encounter.spo2}%`);
  }
  return vitals;
}

export default function PatientMedicalRecordModal({
  open,
  onClose,
  patient,
}: PatientMedicalRecordModalProps) {
  const [encounters, setEncounters] = useState<PatientEncounterDto[]>([]);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // `offline` drives whether the banner blames the backend being down, so a 4xx
  // is not reported with a "is :8083 running?" hint it does not deserve.
  const [failure, setFailure] = useState<{
    message: string;
    offline: boolean;
  } | null>(null);

  const patientId = patient?.userId;

  useEffect(() => {
    if (!open || patientId === undefined) return;

    const controller = new AbortController();
    let cancelled = false;

    Promise.resolve()
      .then(() => {
        setIsLoading(true);
        setFailure(null);
        setEncounters([]);
        setExpandedIds([]);
        return getPatientEncountersApi(patientId, controller.signal);
      })
      .then((list) => {
        if (cancelled) return;
        setEncounters(list);
        // Audit view opens on the most recent encounter: it is the one an
        // administrator is almost always asked about.
        if (list.length > 0) setExpandedIds([list[0].encounterId]);
      })
      .catch((cause: unknown) => {
        // A close/unmount during the flight aborts the request; the next open
        // refetches, so there is nothing to report.
        if (cancelled) return;

        // A 404 is how the backend says "this patient has no encounters yet",
        // which is a legitimate clinical state, not an outage. It falls through
        // to the empty-state card so an administrator never reads a normal
        // "no records" answer as a system failure.
        if (cause instanceof ClinicalApiError && cause.status === 404) {
          setEncounters([]);
          return;
        }

        setFailure({
          message:
            cause instanceof Error
              ? cause.message
              : "Không tải được lịch sử ca khám từ ClinicalConsultationService.",
          offline:
            cause instanceof ClinicalApiError &&
            (cause.isOffline || (cause.status ?? 0) >= 500),
        });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, patientId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Newest first: the service does not document an ordering, and an audit trail
  // that is not chronological is worse than useless.
  const timeline = useMemo(
    () =>
      [...encounters].sort((a, b) => {
        const left = new Date(a.encounterDate).getTime();
        const right = new Date(b.encounterDate).getTime();
        if (Number.isNaN(left) || Number.isNaN(right)) return 0;
        return right - left;
      }),
    [encounters],
  );

  if (!open || !patient) return null;

  const age = ageFrom(patient.dateOfBirth);
  const gender = genderLabel(patient.gender);
  const insurance = patient.insuranceCode?.trim();
  const cccd = patient.identityCardNumber?.trim();

  function toggleEncounter(encounterId: number) {
    setExpandedIds((current) =>
      current.includes(encounterId)
        ? current.filter((id) => id !== encounterId)
        : [...current, encounterId],
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Hồ sơ bệnh án điện tử của ${patient.fullName}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-clinical border border-surface-border bg-surface-light shadow-elevated">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-surface-border bg-surface-card px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Hồ Sơ Bệnh Án Điện Tử
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                Chế độ xem kiểm toán (Chỉ đọc)
              </span>
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">
              {patient.fullName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              <span>users.id = {patient.userId}</span>
              {(age !== null || gender) && (
                <span>
                  {age !== null ? `${age} tuổi` : "—"}
                  {age !== null && gender ? " · " : ""}
                  {gender ?? ""}
                </span>
              )}
              {patient.phone && <span>SĐT {patient.phone}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {insurance ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800">
                  <CreditCard size={10} aria-hidden="true" />
                  BHYT {insurance}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">Chưa đăng ký BHYT</span>
              )}
              {cccd && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
                  CCCD {cccd}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 px-5 py-4">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 rounded-clinical border border-surface-border bg-surface-card px-4 py-10 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Đang tải lịch sử ca khám từ ClinicalConsultationService...
            </div>
          )}

          {!isLoading && failure && (
            <div className="flex items-start gap-3 rounded-clinical border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle
                size={16}
                className="mt-0.5 shrink-0 text-red-600"
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-bold text-red-800">
                  Không tải được hồ sơ bệnh án
                </p>
                <p className="mt-0.5 text-xs text-red-700">{failure.message}</p>
                {failure.offline && (
                  <p className="mt-1 text-[11px] text-red-600">
                    Endpoint{" "}
                    <code>/api/v1/clinical/encounters/patient/{patient.userId}</code>{" "}
                    cần ClinicalConsultationService (:8083) đang chạy.
                  </p>
                )}
              </div>
            </div>
          )}

          {!isLoading && !failure && timeline.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-clinical border border-dashed border-surface-border bg-surface-card px-4 py-12 text-center">
              <FileText size={28} className="text-slate-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">
                Chưa có hồ sơ bệnh án
              </p>
              <p className="max-w-md text-xs text-slate-500">
                Bệnh nhân chưa có lượt khám lâm sàng hoặc hồ sơ chưa được bác sĩ phê
                duyệt hoàn tất.
              </p>
              <p className="text-[11px] text-slate-400">
                Chưa ghi nhận ca khám bệnh nào trong cơ sở dữ liệu lâm sàng.
              </p>
            </div>
          )}

          {!isLoading && !failure && timeline.length > 0 && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck size={12} className="text-clinical-600" aria-hidden="true" />
              {timeline.length} ca khám được ghi nhận · dữ liệu lấy trực tiếp từ
              ClinicalConsultationService
            </p>
          )}

          {timeline.map((encounter) => {
            const status = STATUS_BADGE[encounter.status] ?? {
              label: encounter.status,
              className: "bg-slate-100 text-slate-600 border-slate-200",
            };
            const expanded = expandedIds.includes(encounter.encounterId);
            const vitals = vitalsOf(encounter);
            const diagnoses = encounter.diagnoses ?? [];

            return (
              <article
                key={encounter.encounterId}
                className="overflow-hidden rounded-clinical border border-surface-border bg-surface-card shadow-card"
              >
                <button
                  type="button"
                  onClick={() => toggleEncounter(encounter.encounterId)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        {formatEncounterDate(encounter.encounterDate)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                      <span className="font-mono">
                        #{encounter.ticketNumber}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Stethoscope size={11} aria-hidden="true" />
                        {encounter.doctorName || "—"}
                      </span>
                      {diagnoses.length > 0 && (
                        <span>{diagnoses.length} chẩn đoán</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`shrink-0 text-slate-400 transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {expanded && (
                  <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                    {/* ICD-10 */}
                    {diagnoses.length > 0 ? (
                      <div>
                        <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          Chẩn đoán ICD-10
                        </h4>
                        <ul className="flex flex-wrap gap-1.5">
                          {diagnoses.map((diagnosis) => (
                            <li
                              key={`${diagnosis.icd10Code}-${diagnosis.diseaseName}`}
                              className="inline-flex items-center gap-1.5 rounded-full border border-clinical-200 bg-clinical-50 px-2 py-0.5 text-[11px] text-clinical-900"
                            >
                              <span className="font-mono font-bold">
                                {diagnosis.icd10Code}
                              </span>
                              <span>{diagnosis.diseaseName}</span>
                              {diagnosis.isPrimary && (
                                <span className="rounded-full bg-clinical-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  Chính
                                </span>
                              )}
                              {typeof diagnosis.aiConfidence === "number" && (
                                <span className="text-[10px] text-clinical-700">
                                  AI{" "}
                                  {Math.round(diagnosis.aiConfidence * 100)}%
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        Chưa có chẩn đoán ICD-10 được ghi nhận.
                      </p>
                    )}

                    {/* Vitals - only when the service returns them */}
                    {vitals.length > 0 && (
                      <div>
                        <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          Sinh hiệu
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {vitals.map((vital) => (
                            <span
                              key={vital}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                            >
                              {vital}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SOAP - native <details> keeps each note collapsible without
                        a state update per toggle. */}
                    <div>
                      <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Tóm tắt SOAP
                      </h4>
                      <div className="space-y-1.5">
                        {SOAP_SECTIONS.map((section) => {
                          const value = note(
                            encounter[section.key] as string | null | undefined,
                          );
                          return (
                            <details
                              key={section.key}
                              className="group rounded-lg border border-slate-200 bg-slate-50/70"
                            >
                              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-clinical-100 text-[11px] font-bold text-clinical-700">
                                  {section.letter}
                                </span>
                                {section.label}
                                <span className="text-[11px] font-normal text-slate-400">
                                  {value ? "" : "— không có nội dung"}
                                </span>
                                <ChevronDown
                                  size={14}
                                  aria-hidden="true"
                                  className="ml-auto shrink-0 text-slate-400 transition-transform group-open:rotate-180"
                                />
                              </summary>
                              <p className="whitespace-pre-wrap break-words border-t border-slate-200 px-3 py-2 text-xs leading-relaxed text-slate-700">
                                {value ?? "Không có nội dung."}
                              </p>
                            </details>
                          );
                        })}
                      </div>
                    </div>

                    {/* Prescription */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11px]">
                      {typeof encounter.prescriptionId === "number" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">
                          <Pill size={10} aria-hidden="true" />
                          Đã kê đơn thuốc điện tử (Mã đơn: #
                          {encounter.prescriptionId})
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Không có đơn thuốc đi kèm.
                        </span>
                      )}
                      {note(encounter.createdAt) && (
                        <span className="ml-auto text-slate-400">
                          <RefreshCw size={10} className="mr-1 inline" />
                          Tạo lúc {formatEncounterDate(encounter.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* Footer - read-only is the contract, so say so instead of hiding it. */}
        <div className="flex items-center justify-between gap-3 border-t border-surface-border bg-surface-card px-5 py-3">
          <p className="text-[11px] text-slate-400">
            Bệnh án do bác sĩ phụ trách ghi và ký. Quản trị viên chỉ được xem, không
            sửa.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}