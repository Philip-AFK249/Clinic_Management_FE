import { useState } from "react";
import { toast } from "sonner";
import { Camera, X, QrCode } from "lucide-react";
import type { PharmacyOrder } from "../data/pharmacyTypes";

interface QrVerificationModalProps {
  open: boolean;
  order: PharmacyOrder;
  onClose: () => void;
  onVerified: (order: PharmacyOrder) => void;
}

export default function QrVerificationModal({
  open,
  order,
  onClose,
  onVerified,
}: QrVerificationModalProps) {
  const [scanning, setScanning] = useState(false);
  const [matched, setMatched] = useState(false);

  if (!open) return null;

  function simulateScan() {
    setScanning(true);
    window.setTimeout(() => {
      setScanning(false);
      setMatched(true);
      toast.success(
        `✓ Khớp mã đơn thuốc ${order.orderId} của bệnh nhân ${order.patientName}.`,
        { duration: 4000 },
      );
      onVerified(order);
    }, 1600);
  }

  function close() {
    onClose();
    setMatched(false);
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Đóng quét mã QR"
        onClick={close}
        className="absolute inset-0 bg-slate-900/40"
      />

      {/* Scanner panel */}
      <div className="absolute inset-x-0 top-1/2 mx-auto w-full max-w-md -translate-y-1/2 overflow-hidden">
        <div className="rounded-2xl border border-slate-200 bg-surface-light shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-900">
                Quét Mã QR Bệnh Nhân
              </p>
              <p className="text-xs text-slate-500">
                Đối chiếu phiếu khám tại quầy thuốc
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Đóng cửa sổ"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-4">
            {/* Viewport with laser scan */}
            <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-slate-300 bg-slate-900">
              <span className="flex flex-col items-center gap-3 text-slate-400">
                <QrCode className="h-24 w-24" />
<span className="font-mono text-xs">{order.ticketCode}</span>
              </span>
              {scanning && (
                <span
                  className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_2px_rgba(16,185,129,0.9)] animate-laser-scan"
                  aria-hidden="true"
                />
              )}
            </div>

            {!matched ? (
              <button
                type="button"
                onClick={simulateScan}
                disabled={scanning}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                {scanning ? "Đang quét..." : "Quét mã phiếu của bệnh nhân"}
              </button>
            ) : (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-700">
                ✓ Đã khớp phiếu của {order.patientName} ({order.ticketCode})
              </p>
            )}

            <button
              type="button"
              onClick={close}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}