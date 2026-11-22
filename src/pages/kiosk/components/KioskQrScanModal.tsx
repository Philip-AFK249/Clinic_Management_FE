import { useState } from "react";
import { CheckCircle2, QrCode, ScanLine, X } from "lucide-react";
import type { KioskPatient } from "../data/kioskMockData";
import { ROOMS } from "../data/kioskMockData";

interface KioskQrScanModalProps {
  patient: KioskPatient;
  onClose: () => void;
  onVerified: () => void;
}

export default function KioskQrScanModal({
  patient,
  onClose,
  onVerified,
}: KioskQrScanModalProps) {
  const [scanning, setScanning] = useState(false);
  const [verified, setVerified] = useState(false);

  const targetRoom = ROOMS.find((room) => room.number === "201");

  function simulateScan() {
    setScanning(true);
    window.setTimeout(() => {
      setScanning(false);
      setVerified(true);
      window.setTimeout(onVerified, 900);
    }, 1500);
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Đóng quét mã QR"
        onClick={verified ? onClose : () => undefined}
        className="absolute inset-0 bg-slate-900/40"
      />

      <div className="absolute inset-x-0 top-1/2 mx-auto w-full max-w-lg -translate-y-1/2 px-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface-light shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-5 py-3">
            <div>
              <p className="text-lg font-bold text-slate-900">
                Quét Mã Vé Hẹn Khám
              </p>
              <p className="text-xs text-slate-500">
                Đưa mã QR trên điện thoại vào khung bên dưới
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ"
              disabled={scanning}
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-5 p-5">
            {/* Viewfinder */}
            <div className="relative mx-auto flex aspect-square w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-300 bg-slate-900">
              <span className="flex flex-col items-center gap-2 text-slate-400">
                <QrCode className="h-32 w-32" />
                <span className="font-mono text-sm">{patient.ticketCode}</span>
              </span>
              {scanning && (
                <span
                  className="absolute inset-x-0 h-1 bg-emerald-400 shadow-[0_0_14px_3px_rgba(16,185,129,0.9)] animate-laser-scan"
                  aria-hidden="true"
                />
              )}
              {verified && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-50/30">
                  <CheckCircle2 className="h-20 w-20 text-emerald-500" />
                  <span className="text-lg font-bold text-white drop-shadow">
                    Đã Khớp!
                  </span>
                </span>
              )}
            </div>

            {!verified ? (
              <button
                type="button"
                onClick={simulateScan}
                disabled={scanning}
                className="flex h-16 w-full items-center justify-center gap-3 rounded-xl bg-clinical-600 text-lg font-bold text-white shadow-md transition-all hover:bg-clinical-700 active:scale-95 disabled:bg-slate-300 disabled:text-slate-500"
              >
                <ScanLine className="h-6 w-6" aria-hidden="true" />
                {scanning ? "Đang Quét..." : "🎯 Giả lập đưa mã QR: Bệnh nhân Nguyễn Văn An"}
              </button>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Bệnh nhân: {patient.patientName}
                </p>
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  Khối khám: Khối Ngoại ({targetRoom?.number})
                </p>
                <p className="text-xs font-medium text-emerald-700">
                  Giờ hẹn: 15:30
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}