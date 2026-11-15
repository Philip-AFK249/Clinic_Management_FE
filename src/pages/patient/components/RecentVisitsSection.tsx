import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  FileText,
  Loader2,
  Pill,
  Stethoscope,
  Wallet,
} from "lucide-react";
import { useAuth } from "../../../context/useAuth";
import type { PatientEncounterDto } from "../../../services/clinicalApi";
import { identifierCandidates } from "../data/patientIdentifiers";
import {
  encounterKey,
  loadPatientEncounters,
} from "../data/patientEncounterLoader";

const DEPARTMENT_LABELS: Record<number, string> = {
  1: "Khoa Nội Tổng quát & Tim mạch",
  2: "Khoa Hô hấp & Dị ứng",
  3: "Khoa Da liễu",
};

function vnd(value: number | null | undefined): string {
  const amount =
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${amount.toLocaleString("vi-VN")} đ`;
}

function dateLabel(encounter: PatientEncounterDto): string {
  const iso = encounter.encounterDate || encounter.createdAt || "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "--/--/----";
}

function departmentLabel(departmentId: number | undefined): string {
  if (departmentId === undefined) return "Chuyên khoa";
  return DEPARTMENT_LABELS[departmentId] ?? "Chuyên khoa";
}

function doctorLabel(doctorName: string | undefined): string {
  const trimmed = (doctorName ?? "").trim();
  if (!trimmed) return "Bác sĩ phụ trách";
  return /^(BS\.?|Bác sĩ|PGS|TS|ThS|CKI|CKII)\b/i.test(trimmed)
    ? trimmed
    : `BS. ${trimmed}`;
}

function primaryDiagnosis(encounter: PatientEncounterDto): string {
  const diagnoses = encounter.diagnoses ?? [];
  const diagnosis =
    diagnoses.find((item) => item.isPrimary) ?? diagnoses[0] ?? null;
  if (!diagnosis) return "Chưa có chẩn đoán";
  return `${diagnosis.icd10Code} - ${diagnosis.diseaseName}`;
}

export default function RecentVisitsSection() {
  const { user, isAuthenticated } = useAuth();
  const identifiers = useMemo(() => identifierCandidates(user), [user]);
  const [visits, setVisits] = useState<PatientEncounterDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const signedInUser = user;

    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setHasError(false);
      try {
        const { encounters } = await loadPatientEncounters(
          { userId: signedInUser.id, identifiers },
          controller.signal,
        );
        if (cancelled) return;
        setVisits(
          encounters
            .filter((encounter) => encounter.status === "COMPLETED")
            .slice(0, 3),
        );
      } catch {
        if (cancelled) return;
        setHasError(true);
        setVisits([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [identifiers, isAuthenticated, user]);

  if (!isAuthenticated) return null;

  return (
    <section className="border-y border-slate-200/80 bg-slate-50/70">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-clinical-200 bg-white px-3 py-1 text-xs font-semibold text-clinical-700">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Dành cho bạn
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Lịch sử thăm khám gần đây
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
              Chẩn đoán, đơn thuốc và chi phí của những lần khám đã hoàn tất,
              đồng bộ trực tiếp từ bệnh án điện tử.
            </p>
          </div>
          <Link
            to="/patient/dashboard?tab=ehr"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-clinical-200 bg-white px-5 text-sm font-semibold text-clinical-700 transition-colors hover:border-clinical-400 hover:bg-clinical-50"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Mở hồ sơ sức khỏe
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <Loader2
              className="h-5 w-5 animate-spin text-clinical-600"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-500">
              Đang tải lịch sử thăm khám...
            </p>
          </div>
        ) : visits.length === 0 ? (
          <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-clinical-50 text-clinical-700">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {hasError
                    ? "Chưa tải được lịch sử thăm khám"
                    : "Bạn chưa có lượt khám nào đã hoàn tất"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  Hồ sơ bệnh án, đơn thuốc và chi phí sẽ xuất hiện tại đây sau
                  khi bác sĩ ký bệnh án.
                </p>
              </div>
            </div>
            <Link
              to="/patient/dashboard?tab=ehr"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-clinical-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-clinical-700"
            >
              Xem hồ sơ sức khỏe
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {visits.map((visit) => {
              const items = visit.prescriptionItems ?? [];
              return (
                <Link
                  key={encounterKey(visit)}
                  to="/patient/dashboard?tab=ehr"
                  className="group flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-clinical-300 hover:shadow-card"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {dateLabel(visit)}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Đã hoàn tất
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-600">
                      {visit.ticketNumber}
                    </span>
                    <span>{departmentLabel(visit.departmentId)}</span>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <Stethoscope
                      className="h-4 w-4 shrink-0 text-clinical-600"
                      aria-hidden="true"
                    />
                    {doctorLabel(visit.doctorName)}
                  </p>
                  <p
                    title={primaryDiagnosis(visit)}
                    className="mt-2 line-clamp-2 rounded-lg border border-clinical-100 bg-clinical-50/70 px-2.5 py-1.5 text-xs font-semibold leading-relaxed text-clinical-800"
                  >
                    {primaryDiagnosis(visit)}
                  </p>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Pill className="h-3.5 w-3.5" aria-hidden="true" />
                      {items.length > 0
                        ? `${items.length} loại thuốc`
                        : "Không kê đơn"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900">
                      <Wallet className="h-3.5 w-3.5 text-clinical-600" aria-hidden="true" />
                      {vnd(visit.patientCopayAmount)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
