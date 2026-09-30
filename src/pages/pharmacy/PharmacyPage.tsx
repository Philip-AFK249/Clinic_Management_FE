import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  PackageCheck,
  Printer,
  RefreshCw,
  X,
  QrCode,
  MessageCircle,
} from "lucide-react";
import PharmacyHeader from "./components/PharmacyHeader";
import PrescriptionQueueList from "./components/PrescriptionQueueList";
import PrescriptionDetailCard from "./components/PrescriptionDetailCard";
import MedicationPackingTray from "./components/MedicationPackingTray";
import QrVerificationModal from "./components/QrVerificationModal";
import BillingSummaryCard from "./components/BillingSummaryCard";
import { usePharmacyQueue } from "./hooks/usePharmacyQueue";
import { usePharmacySession } from "./hooks/usePharmacySession";
import { dispensePrescriptionApi } from "../../services/clinicalApi";

function formatMoney(value: number): string {
  return `${value.toLocaleString("vi-VN")} đ`;
}

export default function PharmacyPage() {
  const queue = usePharmacyQueue();
  const session = usePharmacySession();
  const [isDispensing, setIsDispensing] = useState(false);

  const selectedOrder = queue.selectedOrder;

  function handleToggleItem(itemId: string) {
    queue.toggleItemPacked(itemId);
  }

  function handleVerified() {
    queue.toggleQrScanner();
  }

  function handleMarkCashSettled() {
    if (!selectedOrder) return;
    queue.updatePaymentStatus(selectedOrder.orderId, "SETTLED_AT_COUNTER");
    toast.success("Đã thu tiền mặt tại quầy.", { duration: 3000 });
  }

  /**
   * Final step of the handover: ClinicalConsultationService decrements stock
   * per drug line, stamps the pharmacist and closes the prescription. A 409
   * (out of stock, or another terminal already dispensed it) keeps the order in
   * the queue so the pharmacist can act on the backend's own message.
   */
  async function handleConfirmHandover() {
    if (!selectedOrder || isDispensing) return;
    // `orderId` is the string form of `Prescription.id`; the API wants a number.
    const prescriptionId = Number(selectedOrder.orderId);
    if (!Number.isInteger(prescriptionId)) {
      toast.error("Mã đơn thuốc không hợp lệ, không thể phát thuốc.");
      return;
    }
    setIsDispensing(true);
    try {
      await dispensePrescriptionApi(
        prescriptionId,
        session.pharmacistId,
        session.pharmacistName,
      );
      toast.success(
        `Đã bàn giao thuốc cho bệnh nhân ${selectedOrder.patientName}. Đơn #${selectedOrder.orderId} đã được trừ tồn kho trên ClinicalConsultationService.`,
        { duration: 4000 },
      );
      queue.markDispensed(selectedOrder.orderId);
      queue.refreshQueue();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Không phát được đơn thuốc. Vui lòng thử lại.",
        { duration: 6000 },
      );
      queue.refreshQueue();
    } finally {
      setIsDispensing(false);
    }
  }

  const allPacked =
    selectedOrder !== null &&
    selectedOrder.items.length > 0 &&
    selectedOrder.items.every((item) => item.isPacked);
  const settled =
    selectedOrder?.paymentStatus === "PAID_ONLINE" ||
    selectedOrder?.paymentStatus === "SETTLED_AT_COUNTER";
  const canHandover = allPacked && settled;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-light text-slate-900">
      <PharmacyHeader
        pendingCount={queue.pendingCount}
        readyCount={queue.readyCount}
        dispensedCount={queue.dispensedCount}
        pharmacistName={session.pharmacistName}
        pharmacistInitials={session.initials}
        isRefreshing={queue.isRefreshing}
        onRefresh={queue.refreshQueue}
        onOpenScanner={queue.toggleQrScanner}
      />

      <div className="flex min-h-0 flex-1">
        <PrescriptionQueueList
          orders={queue.orders}
          selectedOrderId={queue.selectedOrderId}
          onSelect={queue.selectOrder}
        />

        {/* Inspection workspace */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {queue.error && (
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{queue.error}</span>
            </div>
          )}

          {selectedOrder ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                <PrescriptionDetailCard order={selectedOrder} />
                <MedicationPackingTray
                  order={selectedOrder}
                  onToggleItem={handleToggleItem}
                />
                <BillingSummaryCard
                  order={selectedOrder}
                  onGenerateVietQr={queue.toggleBillingQr}
                  onMarkCashSettled={handleMarkCashSettled}
                />
              </div>

              {/* FHIR handover dock */}
              <footer className="flex h-14 shrink-0 items-center justify-between gap-3 border-t border-slate-200/80 bg-white px-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      toast.info(
                        `Đã in phiếu hướng dẫn sử dụng thuốc #${selectedOrder.orderId}.`,
                      )
                    }
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    In Phiếu Hướng Dẫn Sử Dụng Thuốc
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      toast.info(
                        `Đã mở hội thoại tư vấn cách dùng thuốc cho ${selectedOrder.patientName}.`,
                      )
                    }
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Tư Vấn Cách Dùng
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {!allPacked
                      ? "Chưa đối soát đủ khay thuốc"
                      : !settled
                        ? "Chưa tất toán thanh toán"
                        : "Sẵn sàng bàn giao"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleConfirmHandover()}
                    disabled={!canHandover || isDispensing}
                    className="inline-flex h-12 items-center gap-2 rounded-lg bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <PackageCheck className="h-5 w-5" aria-hidden="true" />
                    📦 Xác Nhận Bàn Giao Thuốc Cho Người Bệnh
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <PackageCheck className="h-7 w-7" />
              </span>
              <div>
                <p className="text-base font-bold text-slate-900">
                  {queue.isRefreshing
                    ? "Đang tải hàng đợi đơn thuốc..."
                    : "Không có đơn thuốc nào chờ phát"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Đơn mới sẽ xuất hiện ở đây ngay khi bác sĩ phê duyệt bệnh án
                  và đẩy xuống Quầy Dược.
                </p>
              </div>
              <button
                type="button"
                onClick={queue.refreshQueue}
                className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Tải lại hàng đợi
              </button>
            </div>
          )}
        </main>
      </div>

      {selectedOrder && (
        <QrVerificationModal
          open={queue.qrOpen}
          order={selectedOrder}
          onClose={queue.toggleQrScanner}
          onVerified={handleVerified}
        />
      )}

      {/* VietQR popup */}
      {queue.billingQrOpen && selectedOrder && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="VietQR thu tiền"
        >
          <button
            type="button"
            aria-label="Đóng VietQR"
            onClick={queue.toggleBillingQr}
            className="absolute inset-0 bg-slate-900/40"
          />
          <div className="absolute inset-x-0 top-1/2 mx-auto w-full max-w-sm -translate-y-1/2 rounded-2xl border border-slate-200 bg-surface-light p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <p className="text-sm font-bold text-slate-900">
                VietQR - Thu Tiền Tại Quầy
              </p>
              <button
                type="button"
                onClick={queue.toggleBillingQr}
                aria-label="Đóng cửa sổ"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="py-4 text-center">
              <span className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl border border-slate-300 bg-white">
                <QrCode className="h-32 w-32 text-slate-800" />
              </span>
              <p className="mt-3 text-xs text-slate-500">
                Quét mã để thanh toán cho{" "}
                <span className="font-semibold text-slate-700">
                  {selectedOrder.patientName}
                </span>
              </p>
              <p className="mt-0.5 text-sm font-bold text-emerald-700">
                {formatMoney(selectedOrder.patientCopayAmount ?? 0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
