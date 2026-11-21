import { useEffect } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Ticket,
  X,
} from "lucide-react";
import { useAppointmentCountdown } from "../../../hooks/useAppointmentCountdown";
import type { QueueStatus, QueueTicketDetailResponse } from "../../../services/intakeApi";
import { useAppointmentStatus } from "../hooks/useAppointmentStatus";
import type { ActiveAppointment } from "../data/patientMockRecords";

interface AppointmentStatusScreenProps {
  /** What the check-in response just returned; seeds the first render. */
  appointment: ActiveAppointment;
  onClose: () => void;
  /** Re-open the doctor & time-slot step with the triage text still filled in. */
  onRebook: () => void;
  /** Let the host keep its localStorage copy in step with the backend. */
  onStatusChange?: (detail: QueueTicketDetailResponse) => void;
}

const PENDING_MESSAGE =
  "Your booking is currently pending Admin payment confirmation. Please complete transfer within 3 minutes.";
const CANCELLED_MESSAGE =
  "Your booking request was not accepted or expired. Please select another slot.";

/**
 * Post-booking status screen for an online appointment.
 *
 * The check-in answer paints immediately; a two-second poll then owns the
 * truth. While the ticket is `PENDING_APPROVAL` a one-second timer counts down
 * the three-minute transfer hold from an absolute deadline, so switching tabs
 * or a slow response cannot stretch it. Terminal answers replace the pending
 * card instead of stacking another banner on top of it.
 */
export default function AppointmentStatusScreen({
  appointment,
  onClose,
  onRebook,
  onStatusChange,
}: AppointmentStatusScreenProps) {
  const { detail, status, error, lastUpdatedAt, refresh } = useAppointmentStatus({
    patientId: appointment.patientId,
    ticketNumber: appointment.ticketCode,
    initialStatus: appointment.status ?? "PENDING_APPROVAL",
  });

  const effectiveStatus: QueueStatus = status ?? appointment.status ?? "PENDING_APPROVAL";
  const isPending = effectiveStatus === "PENDING_APPROVAL";
  const isCancelled = effectiveStatus === "CANCELLED";
  const isConfirmed = effectiveStatus === "WAITING";

  const countdown = useAppointmentCountdown({
    holdExpiresAt: detail?.holdExpiresAt ?? appointment.holdExpiresAt,
    remainingSeconds: detail?.remainingSeconds ?? appointment.remainingSeconds,
    checkInTime: detail?.checkInTime,
    enabled: isPending,
  });

  useEffect(() => {
    if (detail) onStatusChange?.(detail);
  }, [detail, onStatusChange]);

  const ticketNumber = detail?.ticketNumber ?? appointment.ticketCode;
  const patientName = detail?.patientFullName ?? appointment.patientName;
  const department = detail?.departmentName ?? appointment.department;
  const doctor = detail?.doctorName ?? appointment.doctor;
  const room = detail?.roomNumber ?? appointment.room;
  const date = detail?.appointmentDate ?? appointment.appointmentDate ?? appointment.date;
  const time = (detail?.slotStartTime ?? appointment.timeSlot).slice(0, 5);
  const isUrgent = isPending && countdown.remainingSeconds <= 60;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Appointment Status"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/55 backdrop-blur-sm"
    >
      <div className="grid min-h-full place-items-center p-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-6 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-clinical-600">
                Appointment Status
              </p>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
                Trạng thái lịch hẹn của bạn
              </h2>
              <p className="mt-1 font-mono text-xs font-semibold text-slate-500">
                {ticketNumber} &middot; {date} &middot; {time}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng trạng thái lịch hẹn"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"
              >
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-rose-900">{error}</p>
                  <button
                    type="button"
                    onClick={refresh}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:underline"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Thử lại ngay
                  </button>
                </div>
              </div>
            )}

            {isPending && (
              <section
                aria-live="polite"
                className={`overflow-hidden rounded-xl border ${
                  isUrgent
                    ? "border-rose-200 bg-rose-50/60"
                    : "border-amber-200 bg-amber-50/60"
                }`}
              >
                <div className="flex flex-col items-center gap-3 px-6 py-6 text-center sm:flex-row sm:text-left">
                  <div
                    className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border-2 bg-white ${
                      isUrgent ? "border-rose-300" : "border-amber-300"
                    }`}
                  >
                    <Clock3
                      className={`h-4 w-4 ${isUrgent ? "text-rose-500" : "text-amber-500"}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`font-mono text-2xl font-extrabold tabular-nums ${
                        isUrgent ? "text-rose-600" : "text-amber-700"
                      }`}
                    >
                      {countdown.label}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-base font-bold ${
                        isUrgent ? "text-rose-900" : "text-amber-900"
                      }`}
                    >
                      {PENDING_MESSAGE}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
                      Vui lòng hoàn tất chuyển khoản trong 3 phút để giữ slot.
                      Hệ thống sẽ tự động cập nhật khi Admin xác nhận nhận tiền.
                    </p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/80">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isUrgent ? "bg-rose-500" : "bg-amber-500"
                        }`}
                        style={{ width: `${countdown.progressPercent}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] font-medium text-slate-500">
                      {countdown.isExpired
                        ? "Đã hết thời gian giữ chỗ. Đang chờ hệ thống cập nhật..."
                        : `Đã trôi qua ${countdown.elapsedLabel} · Tự cập nhật mỗi 2 giây`}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {isConfirmed && (
              <section
                aria-live="polite"
                className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-lg font-extrabold tracking-tight text-emerald-900">
                      Appointment Confirmed! Ticket: {ticketNumber}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                      Thanh toán đã được Admin xác nhận. Phiếu của bạn đã vào hàng
                      đợi tiếp đón.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {isCancelled && (
              <section
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-base font-bold text-rose-900">{CANCELLED_MESSAGE}</p>
                    <p className="mt-1 text-sm text-rose-800">
                      Slot đã được giải phóng. Triệu chứng bạn đã khai báo vẫn được
                      giữ lại để đặt lịch nhanh hơn.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {!isPending && !isConfirmed && !isCancelled && (
              <section className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-clinical-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Đang cập nhật trạng thái phiếu...
                  </p>
                  <p className="text-xs text-slate-500">
                    Trạng thái hiện tại: {effectiveStatus}
                  </p>
                </div>
              </section>
            )}

            {/* The ticket details stay visible in every state so the patient
                can always say which booking the message refers to. */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200/80 bg-white p-5 shadow-card sm:grid-cols-3">
              <Detail icon={Ticket} label="Mã phiếu" value={ticketNumber} />
              <Detail icon={ShieldCheck} label="Bệnh nhân" value={patientName} />
              <Detail icon={CalendarClock} label="Ngày & Giờ" value={`${date}, ${time}`} />
              <Detail label="Chuyên khoa" value={department} />
              <Detail icon={Stethoscope} label="Bác sĩ" value={doctor} />
              <Detail icon={MapPin} label="Phòng khám" value={room} />
            </div>

            {isConfirmed && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-5 py-4 sm:flex-row sm:gap-5">
                <div className="rounded-lg bg-white p-2 shadow-card">
                  <QRCodeSVG
                    value={JSON.stringify({ ticket: ticketNumber, patient: patientName, room })}
                    size={96}
                    level="M"
                    fgColor="#0F172A"
                  />
                </div>
                <p className="text-center text-sm leading-relaxed text-slate-600 sm:text-left">
                  Xuất trình mã QR hoặc số phiếu tại quầy tiếp đón. Đến trước 15
                  phút để hoàn tất thủ tục và đo sinh hiệu.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 border-t border-slate-200/80 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              {lastUpdatedAt
                ? `Cập nhật lúc ${lastUpdatedAt.toLocaleTimeString("vi-VN")}`
                : "Đang kết nối..."}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={refresh}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Kiểm tra lại
              </button>
              {isCancelled && (
                <button
                  type="button"
                  onClick={onRebook}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cta px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-cta-hover"
                >
                  Re-book Appointment
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <Link
                to="/patient/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Về bảng điều khiển
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Ticket;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-800" title={value}>
        {value || "—"}
      </p>
    </div>
  );
}
