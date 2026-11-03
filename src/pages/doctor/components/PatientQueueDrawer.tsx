import {
  AlertTriangle,
  ChevronRight,
  FileText,
  History,
  Loader2,
  QrCode,
  RefreshCw,
  RotateCcw,
  Users,
  WifiOff,
} from "lucide-react";
import { useState } from "react";
import type { PatientEncounterDto } from "../../../services/clinicalApi";
import type { PatientRecord, TriageLevel } from "../data/doctorMockData";
import {
  encounterDiagnosisLabel,
  formatEncounterDate,
  primaryDiagnosisOf,
} from "../data/encounterMapper";
import type { QueueSource } from "../hooks/useDoctorQueue";
import { dayOffsetIso, todayIso } from "../hooks/useDoctorQueue";

type SidebarTab = "QUEUE" | "HISTORY";

interface PatientQueueDrawerProps {
  queue: PatientRecord[];
  activePatient: PatientRecord | null;
  /** CALLED/IN_CONSULTATION ticket that must be resumed before calling again. */
  ongoingTicket: PatientRecord | null;
  source: QueueSource;
  isRefreshing: boolean;
  isCalling: boolean;
  /** Day the list is scoped to, `YYYY-MM-DD` - drives the Hôm nay/Ngày mai pills. */
  selectedDate: string;
  /** True when the "from today onward" window is shown instead of one day. */
  isUpcoming: boolean;
  /** Encounters of the current doctor, newest first. */
  history: PatientEncounterDto[];
  isHistoryLoading: boolean;
  historyError: string | null;
  onSelectDate: (date: string) => void;
  onToggleUpcoming: () => void;
  onSelectTicket: (patient: PatientRecord) => void;
  onCallNext: () => void;
  onSkip: (ticketNumber: string) => void;
  onRefresh: () => void;
  onRefreshHistory: () => void;
  onViewEncounter: (encounter: PatientEncounterDto) => void;
  onReExamine: (encounter: PatientEncounterDto) => void;
}

const TRIAGE_STYLES: Record<
  TriageLevel,
  { label: string; className: string }
> = {
  P1: {
    label: "P1 - Khẩn cấp",
    className: "border-red-200 bg-red-50 text-red-700 font-bold",
  },
  P2: {
    label: "P2 - Cần khám sớm",
    className: "border-amber-200 bg-amber-50 text-amber-700 font-semibold",
  },
  P3: {
    label: "P3 - Khám thường",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 font-medium",
  },
};

/** `YYYY-MM-DD` as `dd/MM/yyyy` for the date caption beside the pills. */
function isoToLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** One date-view switch: Hôm nay / Ngày mai / Sắp tới. */
function DatePill({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
        isActive
          ? "border-teal-600 bg-teal-600 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

export default function PatientQueueDrawer({
  queue,
  activePatient,
  ongoingTicket,
  source,
  isRefreshing,
  isCalling,
  selectedDate,
  isUpcoming,
  history,
  isHistoryLoading,
  historyError,
  onSelectDate,
  onToggleUpcoming,
  onSelectTicket,
  onCallNext,
  onSkip,
  onRefresh,
  onRefreshHistory,
  onViewEncounter,
  onReExamine,
}: PatientQueueDrawerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<SidebarTab>("QUEUE");
  const today = todayIso();
  const tomorrow = dayOffsetIso(1);
  /** A future day is read-only for calling: nobody is in the building yet. */
  const viewingFutureDay = !isUpcoming && selectedDate !== today;
  const showingHistory = tab === "HISTORY";
  const refreshing = showingHistory ? isHistoryLoading : isRefreshing;

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-3 border-r border-slate-200/80 bg-white py-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Mở rộng hàng đợi bệnh nhân"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-teal-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <Users className="h-4 w-4" />
        </span>
        <span className="text-xs font-bold text-slate-900">{queue.length}</span>
      </aside>
    );
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200/80 bg-white">
      {/* Drawer header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 px-3 py-2.5">
        <div>
          <p className="text-sm font-bold text-slate-900">
            {showingHistory ? "Lịch sử đã khám" : "Hàng đợi Bệnh nhân"}
          </p>
          <p className="text-xs text-slate-500">
            {showingHistory
              ? "Các ca khám của bác sĩ, mới nhất trước."
              : "Sắp xếp ưu tiên theo Triage & Thời gian chờ."}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!showingHistory && (
            <span
              title={
                source === "live"
                  ? "Đang đồng bộ với hàng đợi thật"
                  : "Chưa kết nối được hàng đợi - đang dùng dữ liệu mô phỏng"
              }
              className={`inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-semibold ${
                source === "live"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {source === "live" ? (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot"
                  aria-hidden="true"
                />
              ) : (
                <WifiOff className="h-2.5 w-2.5" aria-hidden="true" />
              )}
              {source === "live" ? "Trực tiếp" : "Mô phỏng"}
            </span>
          )}
          <button
            type="button"
            onClick={showingHistory ? onRefreshHistory : onRefresh}
            disabled={refreshing}
            aria-label={
              showingHistory
                ? "Làm mới lịch sử khám"
                : "Làm mới hàng đợi bệnh nhân"
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-teal-700 disabled:opacity-40"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Thu gọn hàng đợi bệnh nhân"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-teal-700"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
        </div>
      </div>

      {/* Primary tab switcher */}
      <div
        role="tablist"
        aria-label="Khu vực bên trái"
        className="grid grid-cols-2 gap-1 border-b border-slate-200/80 bg-slate-50 p-1.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!showingHistory}
          onClick={() => setTab("QUEUE")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
            !showingHistory
              ? "bg-white text-teal-700 shadow-sm"
              : "text-slate-600 hover:bg-white/70"
          }`}
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Hàng đợi khám
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={showingHistory}
          onClick={() => setTab("HISTORY")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
            showingHistory
              ? "bg-white text-teal-700 shadow-sm"
              : "text-slate-600 hover:bg-white/70"
          }`}
        >
          <History className="h-3.5 w-3.5" aria-hidden="true" />
          Lịch sử đã khám
        </button>
      </div>

      {!showingHistory && (
        <>
          {/* Date navigation: a ticket booked for tomorrow only shows once
              tomorrow (or the upcoming window) is selected. */}
          <div className="flex items-center gap-1.5 border-b border-slate-200/80 px-3 py-2">
            <DatePill
              label="Hôm nay"
              isActive={!isUpcoming && selectedDate === today}
              onClick={() => onSelectDate(today)}
            />
            <DatePill
              label="Ngày mai"
              isActive={!isUpcoming && selectedDate === tomorrow}
              onClick={() => onSelectDate(tomorrow)}
            />
            <DatePill
              label="Sắp tới"
              isActive={isUpcoming}
              onClick={onToggleUpcoming}
            />
            <span className="ml-auto text-[11px] font-semibold text-slate-500">
              {isUpcoming ? "Từ hôm nay trở đi" : isoToLabel(selectedDate)}
            </span>
          </div>

          {/* Call next action */}
          <div className="border-b border-slate-200/80 p-3">
        <button
          type="button"
          onClick={() => {
            // An in-progress ca wins over a new call: the backend rejects
            // call-next with a 409 while one is still open, so resume it.
            if (ongoingTicket) onSelectTicket(ongoingTicket);
            else onCallNext();
          }}
          disabled={
            isRefreshing ||
            isCalling ||
            viewingFutureDay ||
            (Boolean(activePatient) && !ongoingTicket)
          }
          title={
            isRefreshing
              ? "Đang tải hàng đợi, vui lòng chờ trong giây lát."
              : viewingFutureDay
                ? "Chỉ gọi bệnh nhân trong ngày hôm nay - lịch mai chưa đến ca."
                : activePatient && !ongoingTicket
                  ? "Hoàn thành hoặc bỏ qua ca hiện tại trước khi gọi số tiếp theo."
                  : ongoingTicket
                    ? "Mở lại ca khám đang thực hiện."
                    : undefined
          }
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {isCalling ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          )}
          {isCalling
            ? "Đang gọi bệnh nhân..."
            : ongoingTicket
              ? `Tiếp tục khám phiếu ${ongoingTicket.ticketNumber}`
              : activePatient
                ? `Đang khám: ${activePatient.ticketNumber}`
                : "Gọi Bệnh Nhân Tiếp Theo"}
        </button>
      </div>

      {/* Queue list */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {queue.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">
            Hàng đợi đang trống.
          </p>
        )}
        {queue.map((patient) => {
          const triage = TRIAGE_STYLES[patient.triage];
          return (
            <article
              key={patient.ticketNumber}
              role="button"
              tabIndex={0}
              aria-label={`Mở ca khám ${patient.ticketNumber} cho ${patient.name}`}
              onClick={() => onSelectTicket(patient)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectTicket(patient);
                }
              }}
              className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card transition-colors hover:border-teal-300 hover:bg-teal-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${triage.className}`}
                >
                  {triage.label}
                </span>
                <span className="text-xs font-semibold text-slate-900">
                  {patient.ticketNumber}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">
                {patient.name}
              </p>
              <p className="text-xs text-slate-500">
                {patient.age > 0 ? `${patient.age} tuổi, ` : ""}
                {patient.gender} &middot; Đến lúc {patient.arrivalTime} &middot;
                Điểm{" "}
                <span className="font-semibold text-teal-700">
                  {patient.priorityScore}
                </span>
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                {patient.chiefComplaint}
              </p>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  {patient.source === "Kiosk QR" || patient.source === "Kiosk OCR" ? (
                    <QrCode className="h-3 w-3" />
                  ) : (
                    <span className="inline-block h-2 w-2 rounded-full bg-teal-500" />
                  )}
                  {patient.source}
                </span>
                <button
                  type="button"
                  disabled={isRefreshing}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSkip(patient.ticketNumber);
                  }}
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Bỏ qua
                </button>
              </div>
            </article>
          );
        })}
      </div>
        </>
      )}

      {showingHistory && (
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {historyError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {historyError}
            </p>
          )}

          {isHistoryLoading && history.length === 0 && (
            <p className="flex items-center justify-center gap-2 py-6 text-center text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Đang tải lịch sử khám...
            </p>
          )}

          {!isHistoryLoading && !historyError && history.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">
              Chưa có ca khám nào.
            </p>
          )}

          {history.map((encounter) => {
            const diagnosis = primaryDiagnosisOf(encounter);
            const statusLabel =
              encounter.status === "IN_PROGRESS"
                ? "Đang khám"
                : encounter.status === "CANCELLED"
                  ? "Đã hủy"
                  : "Hoàn tất";
            return (
              <article
                key={encounter.encounterId}
                className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-600">
                    {encounter.ticketNumber}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {formatEncounterDate(encounter)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {encounter.patientName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    title={encounterDiagnosisLabel(encounter)}
                    className="max-w-[190px] truncate rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700"
                  >
                    {diagnosis
                      ? `${diagnosis.icd10Code} - ${diagnosis.diseaseName}`
                      : "Chưa có chẩn đoán"}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {statusLabel}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onViewEncounter(encounter)}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:text-teal-700"
                  >
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    Xem bệnh án
                  </button>
                  <button
                    type="button"
                    onClick={() => onReExamine(encounter)}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-teal-600 text-[11px] font-semibold text-white transition-colors hover:bg-teal-700"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    Khám lại
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}