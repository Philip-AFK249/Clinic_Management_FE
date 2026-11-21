import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  Clock,
  FileText,
  QrCode,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { QueueStatus } from "../../../services/intakeApi";
import type { ActiveAppointment } from "../data/patientMockRecords";

type PaymentMode = "NONE" | "VIETQR" | "COUNTER";

/**
 * Reservation state on the confirmation card. Only the two states introduced
 * with online deposits need their own wording; the older queue states keep the
 * "Đặt Lịch Khám Thành Công!" framing this modal has always used.
 */
const STATUS_BADGES: Partial<Record<QueueStatus, { label: string; className: string }>> = {
  PENDING_PAYMENT: {
    label: "Chờ thanh toán cọc",
    className: "border-amber-200 bg-amber-100 text-amber-800",
  },
  EXPIRED: {
    label: "Hết hạn thanh toán",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
};

const CONSULTATION_FEE = "150,000 VND";
const VIETQR_PAYLOAD =
  "00020101021229370016A0000007270123000697040410123456789010SMARTCLINIC520457245802VN5909SMARTCLINC6007HANOI6304A12B";

function formatCountdown(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

interface BookingTicketModalProps {
  appointment: ActiveAppointment;
  onClose: () => void;
}

export default function BookingTicketModal({
  appointment,
  onClose,
}: BookingTicketModalProps) {
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("NONE");
  const [seconds, setSeconds] = useState(300);
  const paymentDone = seconds <= 0;
  const statusBadge = appointment.status
    ? STATUS_BADGES[appointment.status]
    : undefined;

  useEffect(() => {
    if (paymentMode !== "VIETQR" || seconds <= 0) return;
    const handle = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(handle);
  }, [paymentMode, seconds]);

  function handleDownloadPass() {
    toast.info(
      `PDF Pass ${appointment.ticketCode} đã được tạo. Kiểm tra email hoặc sinh mã QR tại kiosk tầng trệt.`,
      { duration: 4000 },
    );
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
                Đặt Lịch Khám Thành Công!
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
            {/* Digital pass card */}
            <div className="overflow-hidden rounded-xl border border-slate-200/80 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-clinical-600 to-clinical-700 px-5 py-3 text-white">
                <p className="text-sm font-bold uppercase tracking-wide">
                  Vé Check-in Điện tử
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {statusBadge && (
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>
                  )}
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
                    BHYT Đã xác thực
                  </span>
                </div>
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
                  label="Chuyên khoa"
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
                  Quét mã QR này tại bất kỳ kiosk cửa vào nào để lấy số thứ tự
                  trong 5 giây.
                </p>
              </div>
            </div>

            {/* Payment settlement */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
              <p className="text-sm font-semibold text-slate-900">
                Thanh toán viện phí
              </p>
              {paymentMode === "NONE" && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("VIETQR")}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-clinical-200 bg-clinical-50 px-4 text-sm font-semibold text-clinical-700 transition-colors hover:bg-clinical-100"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Thanh toán qua VietQR ({CONSULTATION_FEE})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("COUNTER")}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    Thanh toán tại quầy tiếp đón
                  </button>
                </div>
              )}

              {paymentMode === "VIETQR" && !paymentDone && (
                <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="flex items-center justify-between gap-6">
                    <QRCodeSVG value={VIETQR_PAYLOAD} size={128} level="M" />
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-900">
                        Smart Clinic VietQR
                      </p>
                      <p className="text-xs text-slate-500">
                        Phí khám
                      </p>
                      <p className="text-base font-bold text-clinical-700">
                        {CONSULTATION_FEE}
                      </p>
                      <p className="mt-1 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                        <Clock className="h-3 w-3 text-clinical-600" aria-hidden="true" />
                        Tự động xác nhận trong {formatCountdown(seconds)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSeconds(0)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Giả lập thanh toán thành công
                  </button>
                </div>
              )}

              {paymentMode === "VIETQR" && paymentDone && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800">
                      Đã nhận thanh toán qua VietQR
                    </p>
                    <p className="text-sm text-emerald-700">
                      {CONSULTATION_FEE} đã được thanh toán. Hóa đơn điện tử đã
                      gửi tới điện thoại của bạn.
                    </p>
                  </div>
                </div>
              )}

              {paymentMode === "COUNTER" && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Clock className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-slate-600">
                    Bạn đã chọn{" "}
                    <span className="font-semibold text-slate-800">
                      thanh toán tại quầy tiếp đón
                    </span>
                    . Vui lòng xuất trình vé QR khi đến phòng khám.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex flex-col gap-2 border-t border-slate-200/80 px-6 py-4 sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadPass}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <FileText className="h-5 w-5" aria-hidden="true" />
              Tải phiếu PDF
            </button>
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