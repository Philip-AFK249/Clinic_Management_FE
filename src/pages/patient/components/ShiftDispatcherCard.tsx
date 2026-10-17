import {
  AlertOctagon,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Loader2,
  MapPin,
  Sparkles,
  Stethoscope,
  Sun,
  Sunset,
  Users,
} from "lucide-react";
import { ticketPrefixFor } from "../data/clinicContent";
import { formatDoctorName, formatRoom } from "../data/bookingDisplay";
import { sessionScheduleFor } from "../../../services/voiceTriageApi";
import type {
  DoctorShiftInfo,
  SessionName,
  SessionSchedule,
  TriagePriorityLevel,
  VoiceScheduleTriageResponse,
} from "../../../services/voiceTriageApi";
import type { TimeSlotResponse } from "../../../services/intakeApi";
import { getInitialDate, SESSION_SLOT_TIMES, isSlotPast } from "../data/bookingSlots";
import { SlotChip } from "./BookingSlotChips";

/** A concrete bookable pick: which half of the day, which doctor, which hour. */
export interface ShiftSelection {
  session: SessionName;
  doctorId: number | null;
  /** 60-minute start time, `HH:mm`. */
  slotStartTime: string;
}

interface ShiftDispatcherCardProps {
  triage: VoiceScheduleTriageResponse;
  /** What the patient has already picked, echoed back for the pressed state. */
  selected: ShiftSelection | null;
  onSelect: (session: SessionName, doctorId: number | null, slotStartTime: string) => void;
  /** True when the schedule service could not be reached; the picker is hidden. */
  scheduleUnavailable?: boolean;
  /** `YYYY-MM-DD` the schedule below was queried for. */
  targetDate: string;
  onTargetDateChange: (date: string) => void;
  /** True while a re-query for another date is in flight. */
  isRefreshing: boolean;
  /**
   * The live 60-minute slot grid for `targetDate`, when PatientIntakeService
   * answered. Chips for full or unavailable slots are disabled from it; `null`
   * degrades to session-level capacity plus the past-time check only.
   */
  slotAvailability?: TimeSlotResponse[] | null;
  /**
   * Acknowledgement of the medical disclaimer.
   *
   * Required for the same reason as on the rule-based triage card: this replaces
   * that card, and it must not quietly remove the step where a patient is told
   * the output is not a diagnosis.
   */
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
}

const PRIORITY_META: Record<
  TriagePriorityLevel,
  { label: string; pill: string; dot: string }
> = {
  P1: {
    label: "Khẩn cấp",
    pill: "border border-triage-p1/30 bg-triage-p1-bg text-triage-p1",
    dot: "bg-triage-p1",
  },
  P2: {
    label: "Ưu tiên",
    pill: "border border-triage-p2/30 bg-triage-p2-bg text-triage-p2",
    dot: "bg-triage-p2",
  },
  P3: {
    label: "Thường quy",
    pill: "border border-triage-p3/30 bg-triage-p3-bg text-triage-p3",
    dot: "bg-triage-p3",
  },
};

const SESSION_META: Record<
  SessionName,
  { label: string; icon: typeof Sun; fallbackWindow: string }
> = {
  MORNING: { label: "Buổi sáng", icon: Sun, fallbackWindow: "07:30 - 11:30" },
  AFTERNOON: {
    label: "Buổi chiều",
    icon: Sunset,
    fallbackWindow: "13:00 - 17:00",
  },
};

/**
 * Why the dispatcher is not pointing at one of the two sessions.
 *
 * `MANUAL_PICK` is deliberately absent: the gateway is saying it has no
 * preference, not that nothing is available - so no explanatory notice belongs
 * there, and a lookup that returns nothing is the correct outcome.
 */
const NO_SESSION_REASON: Record<string, string> = {
  NEXT_DAY:
    "Hệ thống đề xuất khám vào ngày hôm sau - lịch hôm nay của khoa này đã kín hoặc hết ca trực.",
  NO_DUTY:
    "Khoa này không có ca trực phù hợp với tình trạng của bạn. Vui lòng liên hệ quầy tiếp đón để được hướng dẫn.",
};

/**
 * The rota, one entry per half of the day that actually came back.
 *
 * Goes through `sessionScheduleFor` so the payload's casing convention is
 * handled in one place, and forces `SessionSchedule.session` to the key it came
 * from: that key is what decides which half of the day it is, so a payload whose
 * `session` field disagrees with its slot cannot render a 13:00 shift as morning.
 */
function sessionsOf(triage: VoiceScheduleTriageResponse): SessionSchedule[] {
  const keys: SessionName[] = ["MORNING", "AFTERNOON"];
  return keys
    .map((key) => {
      const value = sessionScheduleFor(triage, key);
      return value ? { ...value, session: key } : null;
    })
    .filter((s): s is SessionSchedule => Boolean(s));
}

/**
 * The clinical verdict and the live rota, side by side.
 *
 * Reads as one decision: *what the AI thinks is wrong, and who can see you about
 * it*. The triage half stays useful on its own, which is why the shift picker
 * degrades to a notice rather than taking the whole card down when the schedule
 * database is unreachable.
 */
export default function ShiftDispatcherCard({
  triage,
  selected,
  onSelect,
  scheduleUnavailable = false,
  targetDate,
  onTargetDateChange,
  isRefreshing,
  slotAvailability = null,
  acknowledged,
  onAcknowledge,
}: ShiftDispatcherCardProps) {
  const priority = PRIORITY_META[triage.priority_level];
  const sessions = sessionsOf(triage);
  const noSessionReason = NO_SESSION_REASON[triage.recommended_shift];
  /**
   * The rota cannot be shown.
   *
   * The backend states this positively as `schedule_connected`, so that is read
   * first; the prop covers the older path where the schedule call failed outright
   * instead of coming back marked disconnected.
   */
  const scheduleDown =
    scheduleUnavailable || triage.schedule_connected === false;

  /** Live capacity per `HH:mm`, so a chip can be disabled the moment it fills. */
  const availabilityByKey = new Map<string, TimeSlotResponse>();
  for (const slot of slotAvailability ?? []) {
    availabilityByKey.set(slot.startTime.slice(0, 5), slot);
  }

  /** Full session, a start time that has already passed, or no capacity left. */
  function slotDisabled(session: SessionSchedule, slot: string): boolean {
    if (session.is_full) return true;
    if (isSlotPast(targetDate, slot)) return true;
    const live = availabilityByKey.get(slot);
    return Boolean(live && (!live.isAvailable || live.availableCapacity <= 0));
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-card">
      <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        <Stethoscope className="h-4 w-4 text-clinical-600" aria-hidden="true" />
        Thẩm định lâm sàng &amp; Điều phối lịch khám
      </p>

      {triage.priority_level === "P1" && <EmergencyBanner advice={triage.advice} />}

      {/* Verdict */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold ${priority.pill}`}
          >
            {triage.priority_level === "P1" ? (
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-triage-p1 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-triage-p1" />
              </span>
            ) : (
              <span
                className={`h-1.5 w-1.5 rounded-full ${priority.dot}`}
                aria-hidden="true"
              />
            )}
            {triage.priority_level} · {priority.label}
          </span>

          <span className="inline-flex items-center rounded-md border border-clinical-200 bg-white px-2 py-0.5 font-mono text-sm font-bold text-clinical-700">
            {ticketPrefixFor(triage.department_id)}-
          </span>

          <span className="text-xs text-slate-500">
            Tiền tố mã số khám của khoa
          </span>
        </div>

        <h3 className="mt-3 text-lg font-bold text-slate-900">
          {triage.disease_guess || "Chưa xác định được bệnh lý"}
          {triage.icd10_code && (
            <span className="ml-2 font-mono text-base text-clinical-700">
              ({triage.icd10_code})
            </span>
          )}
        </h3>

        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <MapPin className="h-4 w-4 shrink-0 text-clinical-600" aria-hidden="true" />
          {triage.department_name}
        </p>

        {triage.chief_complaint_summary && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {triage.chief_complaint_summary}
          </p>
        )}
      </div>

      {triage.advice && triage.priority_level !== "P1" && (
        <div className="rounded-lg border border-clinical-100 bg-clinical-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-clinical-800">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Khuyến nghị lâm sàng
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            {triage.advice}
          </p>
        </div>
      )}

      {/* Date the rota below belongs to. Changing it re-queries the schedule
          immediately - there is no separate "load this date" action to forget. */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="min-w-0">
          <label
            htmlFor="triage-target-date"
            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Ngày khám dự kiến
          </label>
          <input
            id="triage-target-date"
            type="date"
            value={targetDate}
            // Today once the clinic closes is an already-expired choice, so
            // the floor rolls to tomorrow with it (>= 17:00).
            min={getInitialDate()}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            onChange={(event) => onTargetDateChange(event.target.value)}
            className="mt-1 h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-100 disabled:opacity-60"
          />
        </div>
        {isRefreshing && (
          <span className="inline-flex h-10 items-center gap-2 text-xs font-semibold text-clinical-700">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Đang tải lịch khám...
          </span>
        )}
        <p className="text-xs text-slate-500">
          Đổi ngày không mất nội dung bạn đã nói.
        </p>
      </div>

      {scheduleDown ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <CircleSlash className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Hệ thống lịch khám đang tạm không truy cập được
            {triage.schedule_error ? ` (${triage.schedule_error})` : ""}. Kết quả
            thẩm định lâm sàng ở trên vẫn dùng được - bạn có thể chọn khung giờ
            thủ công ở bước tiếp theo.
          </span>
        </p>
      ) : sessions.length === 0 ? (
        <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <CircleSlash className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Chưa có dữ liệu lịch khám cho ngày này.</span>
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sessions.map((session) => (
            <SessionPanel
              key={session.session}
              session={session}
              isRecommended={session.session === triage.recommended_shift}
              selected={selected}
              onSelect={onSelect}
              slotDisabled={(slot) => slotDisabled(session, slot)}
            />
          ))}
        </div>
      )}

      {noSessionReason && !scheduleDown && (
        <p className="flex items-start gap-2 rounded-lg border border-clinical-100 bg-clinical-50 p-3 text-sm text-slate-700">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-clinical-600" aria-hidden="true" />
          <span>{noSessionReason}</span>
        </p>
      )}

      <MedicalDisclaimer acknowledged={acknowledged} onAcknowledge={onAcknowledge} />
    </section>
  );
}

/**
 * The P1 interrupt.
 *
 * `role="alert"` so it is announced rather than merely coloured: at this priority
 * the reading is that the situation may be life-threatening, and a patient using
 * a screen reader must not discover that from a red badge alone. The booking can
 * continue - refusing to book someone who needs help is worse - but the number to
 * call comes first.
 */
function EmergencyBanner({ advice }: { advice: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border-2 border-triage-p1 bg-triage-p1-bg p-4"
    >
      <p className="flex items-center gap-2 text-base font-bold text-triage-p1">
        <AlertOctagon className="h-5 w-5 shrink-0" aria-hidden="true" />
        Dấu hiệu cấp cứu - vui lòng không chờ đặt lịch
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-800">
        Mô tả của bạn được hệ thống đánh dấu là <strong>khẩn cấp (P1)</strong>.{" "}
        {advice ||
          "Nếu bạn đang có triệu chứng như đau ngực, khó thở, sưng môi/lưỡi hoặc phù mạch, hãy gọi ngay 115 hoặc đến khoa Cấp cứu."}
      </p>
      <p className="mt-2 text-sm font-bold text-triage-p1">
        Gọi cấp cứu 115 &middot; hoặc đến thẳng khoa Cấp cứu
      </p>
    </div>
  );
}

interface SessionPanelProps {
  session: SessionSchedule;
  isRecommended: boolean;
  selected: ShiftSelection | null;
  onSelect: (session: SessionName, doctorId: number | null, slotStartTime: string) => void;
  /** Whether a 60-minute chip in this session must render disabled. */
  slotDisabled: (slot: string) => boolean;
}

function SessionPanel({
  session,
  isRecommended,
  selected,
  onSelect,
  slotDisabled,
}: SessionPanelProps) {
  const meta = SESSION_META[session.session];
  const Icon = meta.icon;
  const full = session.is_full;
  /**
   * The outline follows the patient's own pick, not the recommendation: a
   * doctor + slot chosen in this half of the day is what lights the card, so
   * moving to the afternoon must move the highlight with it.
   */
  const isActive = selected?.session === session.session;
  const free = session.doctors
    .filter((doctor) => !doctor.is_full)
    .reduce((sum, doctor) => sum + doctor.available_capacity, 0);
  const sessionSlots = SESSION_SLOT_TIMES[session.session];

  /**
   * A slot chip pressed.
   *
   * Keeps the doctor already chosen in this session - the patient picked a
   * person, not an hour - and otherwise falls back to the first doctor with
   * room, mirroring the backend's own least-busy assignment.
   */
  function handleSlotPick(slot: string) {
    const doctorId =
      (selected?.session === session.session ? selected.doctorId : null) ??
      session.doctors.find((doctor) => !doctor.is_full)?.doctor_id ??
      null;
    onSelect(session.session, doctorId, slot);
  }

  /**
   * A doctor row pressed.
   *
   * Keeps the currently selected hour when it still works for this session, so
   * choosing a person after an hour does not silently move the appointment.
   */
  function handleDoctorPick(doctorId: number | null) {
    const current = selected?.slotStartTime;
    const slot =
      selected?.session === session.session &&
      current &&
      !slotDisabled(current)
        ? current
        : sessionSlots.find((candidate) => !slotDisabled(candidate)) ?? null;
    if (!slot) return;
    onSelect(session.session, doctorId, slot);
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-shadow ${
        isActive
          ? "border-clinical-600 bg-white shadow-md ring-2 ring-clinical-500/20"
          : full
            ? "border-slate-200 bg-slate-50 opacity-70"
            : isRecommended
              ? "border-clinical-300 bg-clinical-50/60"
              : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-clinical-600" aria-hidden="true" />
          <div>
            <p className="text-base font-bold text-slate-900">{meta.label}</p>
            <p className="text-xs text-slate-500">
              {session.time_window || meta.fallbackWindow}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            full
              ? "bg-slate-200 text-slate-600"
              : "bg-triage-p3-bg text-triage-p3"
          }`}
        >
          {full ? "Kín lịch" : `Còn ${free} chỗ`}
        </span>
      </div>

      {isRecommended && (
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-clinical-600 px-2.5 py-1 text-xs font-bold text-white">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Khuyến chọn (Ít chờ đợi nhất)
        </span>
      )}

      {full ? (
        <p className="mt-3 text-sm text-slate-500">
          Ca này đã đủ bệnh nhân. Vui lòng chọn ca còn trống.
        </p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {session.doctors.map((doctor) => (
              <DoctorRow
                key={doctor.doctor_id}
                doctor={doctor}
                isSelected={
                  selected?.session === session.session &&
                  selected?.doctorId === doctor.doctor_id
                }
                onSelect={() => handleDoctorPick(doctor.doctor_id)}
              />
            ))}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Khung giờ khám 60 phút
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sessionSlots.map((slot) => (
                <SlotChip
                  key={slot}
                  slot={slot}
                  isSelected={
                    selected?.session === session.session &&
                    selected.slotStartTime === slot
                  }
                  disabled={slotDisabled(slot)}
                  onSelect={handleSlotPick}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DoctorRow({
  doctor,
  isSelected,
  onSelect,
}: {
  doctor: DoctorShiftInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const full = doctor.is_full;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={full}
      aria-pressed={isSelected}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        isSelected
          ? "border-clinical-600 bg-clinical-50"
          : full
            ? "cursor-not-allowed border-slate-200 bg-slate-50"
            : "border-slate-200 bg-white hover:border-clinical-300 hover:bg-clinical-50/40"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">
          {formatDoctorName(doctor.title, doctor.doctor_name)}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
          {formatRoom(doctor.room_number)}
        </span>
      </span>
      {isSelected ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-clinical-600" aria-hidden="true" />
      ) : full ? (
        <span className="shrink-0 text-xs font-medium text-slate-500">Hết chỗ</span>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {doctor.available_capacity}/{doctor.total_capacity}
        </span>
      )}
    </button>
  );
}

/** The same disclaimer the rule-based triage card carries; both must. */
function MedicalDisclaimer({
  acknowledged,
  onAcknowledge,
}: {
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-start gap-3 text-xs leading-relaxed text-amber-900">
        <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <span>
          Kết quả này do hệ thống AI tạo ra và chỉ phục vụ phân luồng đặt lịch,
          KHÔNG phải chẩn đoán hay tư vấn lâm sàng. Bác sĩ trực sẽ đánh giá lại
          hoàn toàn khi khám. Trong mọi trường hợp khó thở cấp hoặc nguy kịch,
          hãy gọi 115.
        </span>
      </p>

      <label
        htmlFor="dispatcher-ack"
        className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-white p-3"
      >
        <input
          id="dispatcher-ack"
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledge(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-amber-300 text-clinical-600 focus:ring-clinical-500"
        />
        <span className="flex items-start gap-2 text-sm font-medium text-slate-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-clinical-600" aria-hidden="true" />
          Tôi đã đọc và xác nhận rằng kết quả thẩm định này không thay thế cho
          chẩn đoán của bác sĩ.
        </span>
      </label>
    </div>
  );
}
