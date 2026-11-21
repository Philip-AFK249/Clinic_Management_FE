import { CreditCard, Loader2, QrCode, ShieldCheck, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface PaymentConfirmationModalProps {
  ticketNumber: string;
  amount: number;
  isProcessing: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

function vnd(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toLocaleString("vi-VN")} đ`;
}

/**
 * The single confirmation step for the online QR payment. It is deliberately
 * a mock checkout summary: the clinic's payment gateway is represented by the
 * transfer note and QR payload, while the queue service records the receipt.
 */
export default function PaymentConfirmationModal({
  ticketNumber,
  amount,
  isProcessing,
  error,
  onClose,
  onConfirm,
}: PaymentConfirmationModalProps) {
  const transferContent = `THANH TOAN ${ticketNumber}`;
  const qrPayload = `ONLINE_QR|${ticketNumber}|${amount}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isProcessing) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-elevated">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-clinical-600">
              Thanh toán vé online
            </p>
            <h2 id="payment-modal-title" className="mt-1 text-lg font-bold text-slate-900">
              Xác nhận thanh toán
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Đóng"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Phí tư vấn
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">{vnd(amount)}</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-clinical-600 text-white">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4">
            <div className="rounded-lg bg-white p-2 shadow-card">
              <QRCodeSVG value={qrPayload} size={132} level="M" fgColor="#0F172A" />
            </div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <QrCode className="h-4 w-4 text-clinical-600" aria-hidden="true" />
              Quét bằng app ngân hàng hỗ trợ VietQR
            </p>
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Kênh thanh toán</dt>
              <dd className="font-semibold text-slate-900">VietQR / Chuyển khoản</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Nội dung</dt>
              <dd className="text-right font-mono font-semibold text-slate-900">
                {transferContent}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Mã vé</dt>
              <dd className="font-mono font-semibold text-slate-900">{ticketNumber}</dd>
            </div>
          </dl>

          <p className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Sau khi xác nhận, vé sẽ hiển thị <strong>Đã thanh toán — Chờ Admin duyệt</strong>.
            Vé chỉ trở thành vé chính thức khi Admin phê duyệt.
          </p>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Để sau
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-clinical-600 px-4 text-sm font-semibold text-white shadow-card transition-colors hover:bg-clinical-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            )}
            {isProcessing ? "Đang xác nhận..." : "Xác nhận đã thanh toán"}
          </button>
        </div>
      </div>
    </div>
  );
}
