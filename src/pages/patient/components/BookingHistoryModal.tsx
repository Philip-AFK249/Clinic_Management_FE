import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  History,
  Loader2,
  Stethoscope,
  X,
} from "lucide-react";
import { useAuth } from "../../../context/useAuth";
import {
  getPatientBookingHistoryApi,
  IntakeApiError,
} from "../../../services/intakeApi";
import type {
  IntakeSource,
  QueueStatus,
  QueueTicketDetailResponse,
  TriagePriority,
} from "../../../services/intakeApi";
import {
  isAppointmentDateExpired,
  readOwnedActiveBooking,
} from "../data/activeBooking";
import { identifierCandidates } from "../data/patientIdentifiers";
import type { ActiveAppointment } from "../data/patientMockRecords";

interface BookingHistoryModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * One history line.
 *
 * Deliberately its own shape rather than `QueueTicketDetailResponse`: the
 * panel merges the backend's answer with whatever this browser still holds in
 * the booking cache (the only copy an out-of-date service can leave behind),
 * and the two sources do not agree on every field.
 *
 * There is no `patientId` here on purpose. PatientIntakeService's `Patient.id`
 * is not ClinicalConsultationService's patient key - that one is AuthService's
 * `users.id` - so an encounter lookup keyed on it would either find nothing or,
 * worse, another patient's chart. Diagnosis and prescription therefore stay in
 * the EHR tab, which the expanded row links to.
 */
interface HistoryRow {
  key: string;
  ticketNumber: string;
  departmentName: string;
  secondaryDepartmentName: string | null;
  multiSpecialtyNote: string | null;
  doctorName: string;
  roomNumber: string;
  /** `yyyy-MM-dd`, or "" when the cache only kept a display label we could not parse. */
  appointmentDate: string;
  /** `HH:mm`. */
  slotTime: string;
  status: QueueStatus;
  priorityLevel: TriagePriority;
  intakeSource: IntakeSource | null;
  chiefComplaint: string | null;
  checkInTime: string | null;
}

const PRIORITY_LABELS: Record<TriagePriority, string> = {
  P1: "P1 - Khám gấp",
  P2: "P2 - Khám ưu tiên",
  P3: "P3 - Khám thông thường",
};

const INTAKE_SOURCE_LABELS: Record<IntakeSource, string> = {
  ONLINE_BOOKING: "Đặt lịch trực tuyến",
  KIOSK_OCR: "Kiosk (OCR thẻ BHYT)",
  KIOSK_QR: "Kiosk (QR check-in)",
  RECEPTION_MANUAL: "Quầy tiếp đón",
};

interface StatusBadge {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
}

/** Status as the badge prints it, including the date-sensitive WAITING case. */
function badgeFor(row: HistoryRow): StatusBadge {
  switch (row.status) {
    case "COMPLETED":
      return {
        label: "Đã khám xong",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: CheckCircle2,
      };
    case "CANCELLED":
      return {
        label: "Đã hủy",
        className: "border-slate-200 bg-slate-100 text-slate-600",
        icon: Clock,
      };
    case "SKIPPED":
      return {
        label: "Đã bỏ lỡ",
        className: "border-slate-200 bg-slate-50 text-slate-600",
        icon: Clock,
      };
    case "CALLED":
      return {
        label: "Đã được gọi",
        className: "border-clinical-200 bg-clinical-50 text-clinical-700",
        icon: CheckCircle2,
      };
    case "IN_CONSULTATION":
      return {
        label: "Đang khám",
        className: "border-teal-200 bg-teal-50 text-teal-700",
        icon: CheckCircle2,
      };
    case "WAITING":
    default:
      // Still WAITING only tells half the story: a day that has rolled over is
      // not something the patient is still waiting for.
      return isAppointmentDateExpired(row.appointmentDate)
        ? {
            label: "Quá hạn / Không đến",
            className: "border-rose-200 bg-rose-50 text-rose-700",
            icon: CalendarX,
          }
        : {
            label: "Sắp tới",
            className: "border-sky-200 bg-sky-50 text-sky-700",
            icon: CalendarDays,
          };
  }
}

/** `yyyy-MM-dd` as the `dd/MM/yyyy` the patient recognizes. */
function dateLabelFrom(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function rowFromDetail(detail: QueueTicketDetailResponse): HistoryRow {
  return {
    key: detail.ticketNumber,
    ticketNumber: detail.ticketNumber,
    departmentName: detail.departmentName || "—",
    secondaryDepartmentName: detail.secondaryDepartmentName ?? null,
    multiSpecialtyNote: detail.multiSpecialtyNote ?? null,
    doctorName: detail.doctorName || "—",
    roomNumber: detail.roomNumber || "—",
    appointmentDate: detail.appointmentDate,
    slotTime: detail.slotStartTime.slice(0, 5),
    status: detail.status,
    priorityLevel: detail.priorityLevel,
    intakeSource: detail.intakeSource,
    chiefComplaint: detail.chiefComplaint,
    checkInTime: detail.checkInTime,
  };
}

/** `dd/MM/yyyy` (the cached display label) as `yyyy-MM-dd`, or `""`. */
function isoFromLabel(label: string | null | undefined): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(label?.trim() ?? "");
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function rowFromCachedBooking(booking: ActiveAppointment): HistoryRow {
  return {
    key: booking.ticketCode,
    ticketNumber: booking.ticketCode,
    departmentName: booking.department || "—",
    secondaryDepartmentName: null,
    multiSpecialtyNote: null,
    doctorName: booking.doctor || "—",
    roomNumber: booking.room || "—",
    appointmentDate: booking.appointmentDate ?? isoFromLabel(booking.date),
    slotTime: booking.timeSlot,
    status: booking.status ?? "WAITING",
    priorityLevel: "P3",
    intakeSource: null,
    chiefComplaint: null,
    checkInTime: null,
  };
}

/** Newest day first, then latest slot - the order a "history" reads in. */
function sortRows(rows: HistoryRow[]): HistoryRow[] {
  return [...rows].sort((left, right) => {
    const day = right.appointmentDate.localeCompare(left.appointmentDate);
    if (day !== 0) return day;
    return right.slotTime.localeCompare(left.slotTime);
  });
}

/**
 * The API's answer plus this browser's cached booking, de-duplicated by ticket
 * number.
 *
 * The cached copy is not a second source of truth - it is the one record a
 * patient still has when the history route has not been deployed yet, or when
 * PatientIntakeService is briefly unreachable, so it only fills a gap.
 */
function mergeRows(
  list: QueueTicketDetailResponse[],
  cached: ActiveAppointment | null,
): HistoryRow[] {
  const rows = new Map<string, HistoryRow>();
  for (const detail of list) {
    rows.set(detail.ticketNumber, rowFromDetail(detail));
  }
  if (cached && !rows.has(cached.ticketCode)) {
    rows.set(cached.ticketCode, rowFromCachedBooking(cached));
  }
  return sortRows([...rows.values()]);
}

/**
 * Every appointment this patient has ever booked - upcoming, finished, skipped
 * and cancelled - opened from the account menu.
 *
 * The list comes from `getPatientBookingHistoryApi`, addressed by the intake
 * `Patient.id` when the stored booking carried one and by an identifier
 * spelling otherwise. The cached booking is merged in so the panel is never
 * blank while the service is down, and a WAITING row whose day has passed is
 * badged "Quá hạn / Không đến" instead of pretending the patient is still due.
 */
export default function BookingHistoryModal({
  open,
  onClose,
}: BookingHistoryModalProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [failure, setFailure] = useState<{
    message: string;
    offline: boolean;
  } | null>(null);
  const [isStaleSource, setIsStaleSource] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    const controller = new AbortController();
    let cancelled = false;

    const owner = { email: user.email, fullName: user.fullName, phone: user.phone };
    const cached = readOwnedActiveBooking(owner);
    const candidates = identifierCandidates(user, [cached?.phone]);
    const patientId = cached?.patientId;
    const identifier = cached?.phone?.trim() || candidates[0];

    Promise.resolve()
      .then(() => {
        setIsLoading(true);
        setFailure(null);
        setIsStaleSource(false);
        setRows([]);
        setExpandedKeys([]);
        return getPatientBookingHistoryApi(patientId, identifier, controller.signal);
      })
      .then((list) => {
        if (cancelled) return;
        setRows(mergeRows(list, cached));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // A close/unmount during the flight aborts the request; the next open
        // refetches, so there is nothing to report.
        if (controller.signal.aborted) return;
        // Degraded, not failed: whatever this browser still holds is shown, with
        // the reason it is all there. An unreachable service must not read as
        // "you have never booked anything".
        if (cached) {
          setRows(sortRows([rowFromCachedBooking(cached)]));
          setIsStaleSource(true);
          return;
        }
        setFailure({
          message:
            cause instanceof Error
              ? cause.message
              : "Không tải được lịch sử đặt lịch.",
          offline:
            cause instanceof IntakeApiError &&
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
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function toggleRow(key: string) {
    setExpandedKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Lịch sử đặt lịch"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-clinical border border-surface-border bg-surface-light shadow-elevated">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-surface-border bg-surface-card px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-clinical-100 text-clinical-700">
                <History size={16} aria-hidden="true" />
              </span>
              <h3 className="text-sm font-bold text-slate-900">Lịch sử đặt lịch</h3>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Mọi lượt khám bạn đã từng đặt tại phòng khám, gồm cả lịch đã hoàn
              tất, đã hủy và lịch hết hạn.
            </p>
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
              Đang tải lịch sử đặt lịch...
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
                  Không tải được lịch sử đặt lịch
                </p>
                <p className="mt-0.5 text-xs text-red-700">{failure.message}</p>
                {failure.offline && (
                  <p className="mt-1 text-[11px] text-red-600">
                    PatientIntakeService đang không phản hồi. Vui lòng thử lại sau.
                  </p>
                )}
              </div>
            </div>
          )}

          {!isLoading && !failure && isStaleSource && (
            <div className="rounded-clinical border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              Không kết nối được dịch vụ hàng đợi, nên chỉ hiển thị lịch hẹn đang
              còn lưu trên máy này.
            </div>
          )}

          {!isLoading && !failure && rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-clinical border border-dashed border-surface-border bg-surface-card px-4 py-12 text-center">
              <FileText size={28} className="text-slate-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">
                Chưa có lịch hẹn khám nào
              </p>
              <p className="max-w-md text-xs text-slate-500">
                Lịch sử sẽ hiển thị tại đây ngay sau lần đặt lịch đầu tiên của bạn.
              </p>
              <Link
                to="/patient/booking"
                onClick={onClose}
                className="mt-2 inline-flex h-10 items-center justify-center rounded-lg bg-clinical-600 px-5 text-xs font-semibold text-white shadow-card transition-colors hover:bg-clinical-700"
              >
                Đặt lịch khám ngay
              </Link>
            </div>
          )}

          {!isLoading && rows.length > 0 && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <CalendarDays size={12} className="text-clinical-600" aria-hidden="true" />
              {rows.length} lượt khám · mới nhất nằm trên cùng
            </p>
          )}

          {!isLoading &&
            rows.map((row) => {
              const badge = badgeFor(row);
              const expanded = expandedKeys.includes(row.key);
              const expired = isAppointmentDateExpired(row.appointmentDate);

              return (
                <article
                  key={row.key}
                  className="overflow-hidden rounded-clinical border border-surface-border bg-surface-card shadow-card"
                >
                  <button
                    type="button"
                    onClick={() => toggleRow(row.key)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg ${
                        expired ? "bg-rose-50 text-rose-700" : "bg-clinical-50 text-clinical-700"
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase leading-none">
                        {/^(\d{4})-(\d{2})-(\d{2})$/.exec(row.appointmentDate)?.[3] ??
                          "??"}
                      </span>
                      <span className="mt-0.5 text-sm font-bold leading-none">
                        {/^(\d{4})-(\d{2})-(\d{2})$/.exec(row.appointmentDate)?.[2] ??
                          "??"}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {row.ticketNumber}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          <badge.icon size={10} aria-hidden="true" />
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                        {row.departmentName}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Stethoscope size={11} aria-hidden="true" />
                          {row.doctorName}
                        </span>
                        <span>
                          {row.appointmentDate ? dateLabelFrom(row.appointmentDate) : "—"}
                          {row.slotTime ? `, ${row.slotTime}` : ""}
                        </span>
                        <span>{row.roomNumber}</span>
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
                      <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Ngày &amp; Khung giờ
                          </dt>
                          <dd className="mt-0.5 font-medium text-slate-700">
                            {row.appointmentDate ? dateLabelFrom(row.appointmentDate) : "—"}
                            {row.slotTime ? `, ${row.slotTime}` : ""}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Ưu tiên
                          </dt>
                          <dd className="mt-0.5 font-medium text-slate-700">
                            {PRIORITY_LABELS[row.priorityLevel]}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Phòng khám
                          </dt>
                          <dd className="mt-0.5 font-medium text-slate-700">
                            {row.roomNumber}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Check-in
                          </dt>
                          <dd className="mt-0.5 font-medium text-slate-700">
                            {formatDateTime(row.checkInTime)}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Lý do khám
                          </dt>
                          <dd className="mt-0.5 font-medium leading-relaxed text-slate-700">
                            {row.chiefComplaint?.trim() || "—"}
                          </dd>
                        </div>
                        {row.secondaryDepartmentName && (
                          <div className="sm:col-span-2">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Chuyên khoa phối hợp
                            </dt>
                            <dd className="mt-0.5 font-medium leading-relaxed text-slate-700">
                              {row.secondaryDepartmentName}
                              {row.multiSpecialtyNote?.trim() && (
                                <span className="mt-1 block text-xs font-normal text-slate-500">
                                  {row.multiSpecialtyNote}
                                </span>
                              )}
                            </dd>
                          </div>
                        )}
                        {row.intakeSource && (
                          <div className="sm:col-span-2">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Nguồn tiếp đón
                            </dt>
                            <dd className="mt-0.5 font-medium text-slate-700">
                              {INTAKE_SOURCE_LABELS[row.intakeSource] ?? row.intakeSource}
                            </dd>
                          </div>
                        )}
                      </dl>

                      {/* Diagnosis and prescription belong to ClinicalConsultationService,
                          which keys its charts on users.id - not on this ticket's intake
                          patient id - so the portal links across instead of guessing. */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          Chẩn đoán &amp; Đơn thuốc
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">
                          {row.status === "COMPLETED"
                            ? "Ca khám này đã hoàn tất. Bác sĩ ghi chẩn đoán và đơn thuốc (nếu có) trong hồ sơ sức khỏe điện tử của bạn."
                            : "Chẩn đoán và đơn thuốc chỉ được ghi khi ca khám hoàn tất; các lượt khác chưa có nội dung này."}
                        </p>
                        {row.status === "COMPLETED" && (
                          <Link
                            to="/patient/dashboard"
                            onClick={onClose}
                            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:text-clinical-700"
                          >
                            <FileText size={12} aria-hidden="true" />
                            Mở Hồ sơ sức khỏe điện tử
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-surface-border bg-surface-card px-5 py-3">
          <p className="text-[11px] text-slate-400">
            Lịch sử lấy từ PatientIntakeService theo hồ sơ bệnh nhân của bạn.
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
