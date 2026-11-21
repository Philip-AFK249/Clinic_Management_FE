import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { FileText, QrCode, X } from "lucide-react";
import { toast } from "sonner";
import type { ActiveAppointment } from "../data/patientMockRecords";

interface BookingTicketModalProps {
  appointment: ActiveAppointment;
  onClose: () => void;
}

export default function BookingTicketModal({
  appointment,
  onClose,
}: BookingTicketModalProps) {
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
              <div className="flex items-center justify-between bg-gradient-to-r from-clinical-600 to-clinical-700 px-5 py-3 text-white">
                <p className="text-sm font-bold uppercase tracking-wide">
                  Vé Check-in Điện tử
                </p>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
                  BHYT Đã xác thực
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
