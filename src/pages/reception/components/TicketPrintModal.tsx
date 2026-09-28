import { Printer, TicketCheck, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import ThermalBarcode from "./ThermalBarcode";
import type { TicketView } from "../ticketView";
import { estimateWaitMinutes, triageMeta } from "../data/receptionMockData";

function formatDateVi(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

function clockOf(iso: string | null): string {
  if (!iso) return "--:--";
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : "--:--";
}

interface TicketPrintModalProps {
  ticket: TicketView;
  onClose: () => void;
  onNextPatient: () => void;
  /** Reprints from the monitor should not imply clearing the intake form. */
  nextLabel?: string;
}

export default function TicketPrintModal({
  ticket,
  onClose,
  onNextPatient,
  nextLabel = "Bệnh nhân tiếp theo",
}: TicketPrintModalProps) {
  const triage = triageMeta(ticket.priorityLevel);
  const waitMinutes = estimateWaitMinutes(ticket.patientsAhead);
  const qrPayload = JSON.stringify({
    ticket: ticket.ticketNumber,
    patient: ticket.patientName,
    room: ticket.roomNumber,
    doctor: ticket.doctorName,
  });

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Xác nhận cấp số thứ tự"
    >
      {/* Restrict the browser print job to the receipt only. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          [data-print-ticket], [data-print-ticket] * { visibility: visible !important; }
          [data-print-ticket] { position: absolute; left: 0; top: 0; width: 100%; }
          @page { margin: 8mm; }
        }
      `}</style>

      <div className="grid min-h-full place-items-center p-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          {/* Thermal paper preview (~80mm) */}
          <div
            data-print-ticket
            className="w-full overflow-hidden rounded-lg border border-slate-300 bg-white font-mono shadow-2xl"
          >
            <div className="border-b-2 border-dashed border-slate-300 bg-slate-900 px-4 py-3 text-center text-white">
              <p className="text-[11px] font-bold uppercase tracking-widest">
                Smart Clinic Management
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-300">
                Phiếu chờ khám bệnh
              </p>
            </div>

            <div className="px-4 py-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Số thứ tự
              </p>
              <p className="text-4xl font-bold tracking-tight text-slate-900">
                {ticket.ticketNumber}
              </p>
              <p className="mt-1.5 text-sm font-bold text-slate-800">
                {ticket.patientName}
              </p>
              <p className="text-[11px] text-slate-600">{ticket.departmentName}</p>
            </div>

            <div className="space-y-1 border-t border-dashed border-slate-300 px-4 py-3 text-[11px]">
              <Row label="Bác sĩ" value={ticket.doctorName} />
              <Row label="Phòng" value={ticket.roomNumber} />
              <Row
                label="Ngày khám"
                value={formatDateVi(ticket.appointmentDate)}
              />
              <Row
                label="Khung giờ"
                value={`${ticket.slotStartTime.slice(0, 5)} (60 phút)`}
              />
              <Row label="Đến lúc" value={clockOf(ticket.checkInTime)} />
              {ticket.insuranceCode && (
                <Row label="Mã BHYT" value={ticket.insuranceCode} />
              )}
              {ticket.identityCardNumber && (
                <Row label="CCCD" value={ticket.identityCardNumber} />
              )}
              <Row
                label="Ước tính chờ"
                value={`~${waitMinutes} phút (${ticket.patientsAhead} người trước)`}
              />
            </div>

            <div className="border-t-2 border-dashed border-slate-300 px-4 py-3">
              <p
                className={`mb-2 text-center text-xs font-bold uppercase tracking-wider ${
                  ticket.priorityLevel === "P1"
                    ? "text-red-600"
                    : ticket.priorityLevel === "P2"
                      ? "text-amber-600"
                      : "text-emerald-600"
                }`}
              >
                {triage.label}
              </p>
              <ThermalBarcode value={ticket.ticketNumber} height={40} />
              <p className="mt-1 text-center text-[11px] font-bold tracking-widest text-slate-800">
                {ticket.ticketNumber}
              </p>
              <div className="mt-3 flex justify-center">
                <QRCodeSVG value={qrPayload} size={104} level="M" fgColor="#0F172A" />
              </div>
              <p className="mt-1.5 text-center text-[9px] leading-relaxed text-slate-500">
                Quét mã QR tại cổng soát vé để lấy số thứ tự hoặc kiểm tra
                thông tin phiếu.
              </p>
            </div>

            <div className="border-t border-dashed border-slate-300 px-4 py-2 text-center text-[9px] leading-relaxed text-slate-500">
              Vui lòng đến phòng khám trước giờ hẹn 10 phút và giữ thẻ BHYT /
              CCCD để làm thủ tục. Phiếu có giá trị trong ngày.
            </div>
          </div>

          {/* Actions */}
          <div className="flex w-full gap-2 print:hidden">
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng xác nhận"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              In phiếu nhiệt
            </button>
            <button
              type="button"
              onClick={onNextPatient}
              className="inline-flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-lg bg-teal-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              <TicketCheck className="h-4 w-4" aria-hidden="true" />
              {nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-800">{value}</span>
    </div>
  );
}
