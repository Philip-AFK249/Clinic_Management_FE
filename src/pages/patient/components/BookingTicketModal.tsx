import { useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Ban,
  CheckCircle2,
  FileText,
  QrCode,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { QueueTicketDetailResponse } from "../../../services/intakeApi";
import type { ActiveAppointment } from "../data/patientMockRecords";
import {
  isConfirmedTicket,
  isTemporaryStatus,
  NO_CANCEL_POLICY_NOTICE,
  OFFICIAL_TICKET_CONFIRMED,
  OFFICIAL_TICKET_LABEL,
  PAID_PENDING_LABEL,
} from "../data/ticketLifecycle";

interface BookingTicketModalProps {
  appointment: ActiveAppointment;
  /** Live backend answer, when a watcher is polling the ticket. */
  detail?: QueueTicketDetailResponse | null;
  onClose: () => void;
  /** Only offered while the ticket is still a temporary hold. */
  onCancelTemporary?: (ticketNumber: string) => void | Promise<void>;
}

function formatStamp(value: string | null | undefined): string {
  if (!value) return "Đang cập nhật";
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

/** The confirmation screen for both the temporary hold and the official ticket. */
export default function BookingTicketModal({
  appointment,
  detail,
  onClose,
  onCancelTemporary,
}: BookingTicketModalProps) {
  const [isCancelling, setIsCancelling] = useState(false);

  const status = detail?.status ?? appointment.status ?? "WAITING";
  const isTemporary = isTemporaryStatus(status);
  const isRejected = status === "REJECTED";
  const isOfficial = isConfirmedTicket(status);
  const isPaid = detail?.isReceiptVerified ?? appointment.isReceiptVerified ?? false;
  const ticketCode = appointment.ticketCode;
  const confirmedAt = detail?.confirmedAt ?? appointment.confirmedAt ?? null;

  function handleDownloadPass() {
    toast.info(
      `PDF Pass ${appointment.ticketCode} đã được tạo. Kiểm tra email hoặc sinh mã QR tại kiosk tầng trệt.`,
      { duration: 4000 },
    );
  }

  async function handleCancelTemporary() {
    if (!onCancelTemporary || isCancelling) return;
    setIsCancelling(true);
    try {
      await onCancelTemporary(ticketCode);
    } finally {
      setIsCancelling(false);
    }
  }

  const checkInValue = JSON.stringify({
    ticket: appointment.ticketCode,
    patient: appointment.patientName,
    room: appointment.room,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xác nhận lịch khám"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm"
    >
      <div className="grid min-h-full place-items-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-slate-900">
                {isTemporary
                  ? "Vé Online Tạm Thời"
                  : isRejected
                    ? "Vé bị từ chối xác thực"
                    : "Vé Khám Điện Tử"}
              </h3>
              <p className="text-sm text-slate-500">
                Mã phiếu khám {appointment.ticketCode} &middot; Check-in hàng
                ưu tiên nhanh
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng xác nhận"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            {isTemporary ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-card">
                <p className="text-sm font-bold tracking-wide text-slate-900">
                  {isPaid ? PAID_PENDING_LABEL : "Vé tạm thời — Chờ thanh toán"}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Vé sẽ trở thành chính thức sau khi Admin xác thực. Không có giới
                  hạn thời gian giữ chỗ; vé chỉ bị hủy khi Admin từ chối.
                </p>
              </div>
            ) : isRejected ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-card">
                <p className="flex items-center gap-2 text-sm font-bold text-rose-900">
                  <Ban className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Vé online tạm thời đã bị từ chối xác thực.
                </p>
                {appointment.rejectionReason || detail?.rejectionReason ? (
                  <p className="mt-2 text-sm leading-relaxed text-rose-800">
                    Lý do: {detail?.rejectionReason ?? appointment.rejectionReason}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {OFFICIAL_TICKET_LABEL}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    {OFFICIAL_TICKET_CONFIRMED}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-emerald-900">
                  Xác nhận lúc: {formatStamp(confirmedAt)}
                  {appointment.confirmedBy || detail?.confirmedBy
                    ? ` · Bởi ${detail?.confirmedBy ?? appointment.confirmedBy}`
                    : ""}
                </p>
                <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-emerald-800">
                  <ShieldAlert
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{NO_CANCEL_POLICY_NOTICE}</span>
                </p>
              </div>
            )}

            {/* Digital pass card */}
            <div className="overflow-hidden rounded-xl border border-slate-200/80 shadow-card">
              <div
                className={`flex items-center justify-between px-5 py-3 text-white ${
                  isTemporary
                    ? "bg-gradient-to-r from-amber-500 to-amber-600"
                    : isRejected
                      ? "bg-gradient-to-r from-rose-500 to-rose-600"
                      : "bg-gradient-to-r from-emerald-600 to-emerald-700"
                }`}
              >
                <p className="text-sm font-bold uppercase tracking-wide">
                  {isTemporary
                    ? "Vé Giữ Chỗ Online"
                    : isRejected
                      ? "Vé bị từ chối"
                      : "Vé Check-in Điện tử"}
                </p>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
                  {isTemporary
                    ? "Chờ xác thực"
                    : isRejected
                      ? "Đã từ chối"
                      : OFFICIAL_TICKET_CONFIRMED}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-white p-5 sm:grid-cols-4">
                <PassField label="Mã phiếu khám" value={appointment.ticketCode} />
                <PassField
                  label="Ngày & Giờ"
                  value={`${appointment.date}, ${appointment.timeSlot}`}
                />
                <PassField
                  label="Bệnh nhân"
                  value={appointment.patientName}
                  wide
                />
                <PassField
                  label="Khối khám"
                  value={appointment.department}
                  wide
                />
                <PassField
                  label="Bác sĩ phụ trách"
                  value={appointment.doctor}
                  wide
                />
                <PassField label="Phòng" value={appointment.room} />
              </div>
              <p className="border-t border-slate-200/80 bg-teal-50 px-5 py-2.5 text-xs font-medium leading-relaxed text-teal-800">
                Sau check-in, đi thẳng đến {appointment.room || "phòng khám ghi trên phiếu"}.
                Sinh hiệu được đo và nhập ngay tại phòng khám bởi Y tá / Thư ký
                y khoa.
              </p>

              <div className="flex flex-col items-center gap-2 border-t border-slate-200/80 bg-slate-50 px-5 py-4">
                <div className="relative rounded-xl bg-white p-2 shadow-card">
                  <QRCodeSVG
                    value={checkInValue}
                    size={180}
                    level="M"
                    fgColor="#0F172A"
                  />
                  <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-white shadow-sm">
                    <QrCode className="h-6 w-6 text-clinical-600" />
                  </span>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <QrCode className="h-4 w-4 text-clinical-600" aria-hidden="true" />
                  {isTemporary
                    ? "Vé chỉ có giá trị check-in sau khi admin xác thực."
                    : isRejected
                      ? "Vé không còn giá trị check-in. Vui lòng đặt lịch mới."
                      : "Quét mã QR này tại bất kỳ kiosk cửa vào nào để lấy số thứ tự trong 5 giây, sau đó đi thẳng đến phòng khám ghi trên phiếu."}
                </p>
              </div>
            </div>
          </div>

          {/* Footer actions: a confirmed ticket can never be cancelled here. */}
          <div className="flex flex-col gap-2 border-t border-slate-200/80 px-6 py-4 sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadPass}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <FileText className="h-5 w-5" aria-hidden="true" />
              Tải phiếu PDF
            </button>
            {isTemporary ? (
              onCancelTemporary && (
                <button
                  type="button"
                  onClick={() => void handleCancelTemporary()}
                  disabled={isCancelling}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-5 text-base font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Ban className="h-5 w-5" aria-hidden="true" />
                  {isCancelling ? "Đang hủy..." : "Hủy vé tạm thời"}
                </button>
              )
            ) : isRejected ? (
              <span className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-rose-50 px-5 text-sm font-semibold text-rose-700">
                <Ban className="h-4 w-4" aria-hidden="true" />
                Vé tạm thời bị từ chối
              </span>
            ) : (
              <span className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-50 px-5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {isOfficial ? OFFICIAL_TICKET_LABEL : "Vé khám"}
              </span>
            )}
            <Link
              to="/patient/dashboard"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-cta px-5 text-base font-semibold text-white shadow-sm transition-all hover:bg-cta-hover"
            >
              Đến Cổng bệnh nhân
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function PassField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
