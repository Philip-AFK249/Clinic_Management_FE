import { useCallback, useEffect, useMemo, useState } from "react";
import { useDrugCatalog } from "../../../hooks/useDrugCatalog";
import { getPharmacyQueueApi } from "../../../services/clinicalApi";
import type { PrescriptionDetailResponse } from "../../../services/clinicalApi";
import { toPharmacyOrder } from "../data/prescriptionMapper";
import type { PaymentStatus } from "../data/pharmacyTypes";

const POLL_INTERVAL_MS = 10_000;

/**
 * Live dispensing queue backed by
 * `GET /pharmacy/prescriptions?status=PENDING_DISPENSE`.
 *
 * Two things are deliberately *local*: which lines the pharmacist has ticked
 * off and whether a prescription was settled at the counter. Neither exists in
 * ClinicalConsultationService, but both must survive the poll that runs every
 * 10 seconds, so they are held as state keyed by id and re-applied to each
 * incoming payload by the mapper.
 *
 * The dispense call itself is made by `PharmacyPage` (it needs the signed-in
 * pharmacist), so this hook only owns the queue state and `markDispensed`,
 * which retires a prescription once the backend confirms it.
 */
export function usePharmacyQueue() {
  // Joins each prescription line back to its `drugs` row for the BHYT rate.
  const catalog = useDrugCatalog();

  const [prescriptions, setPrescriptions] = useState<PrescriptionDetailResponse[]>(
    [],
  );
  const [packedItemIds, setPackedItemIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [settledPrescriptionIds, setSettledPrescriptionIds] = useState<
    ReadonlySet<number>
  >(() => new Set<number>());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dispensedCount, setDispensedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const [billingQrOpen, setBillingQrOpen] = useState(false);

  const refreshQueue = useCallback(
    () => setReloadToken((token) => token + 1),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function load(showSpinner: boolean) {
      if (showSpinner) setIsRefreshing(true);
      try {
        const live = await getPharmacyQueueApi("PENDING_DISPENSE");
        if (cancelled) return;
        setPrescriptions(live);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        // The last good list stays on screen; only the reason is surfaced.
        setError(
          cause instanceof Error
            ? cause.message
            : "Không tải được hàng đợi đơn thuốc.",
        );
      } finally {
        if (!cancelled) setIsRefreshing(false);
      }
    }

    void load(true);
    const interval = window.setInterval(
      () => void load(false),
      POLL_INTERVAL_MS,
    );
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [reloadToken]);

  const orders = useMemo(
    () =>
      prescriptions.map((prescription) =>
        toPharmacyOrder(prescription, {
          drugsById: catalog.byId,
          packedItemIds,
          settledPrescriptionIds,
        }),
      ),
    [catalog.byId, packedItemIds, prescriptions, settledPrescriptionIds],
  );

  // Keep the selection valid as the queue moves: fall back to the head when
  // the selected order was dispensed or the queue was empty on first render.
  const selectedOrder =
    orders.find((order) => order.orderId === selectedOrderId) ??
    orders[0] ??
    null;

  const selectOrder = useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
  }, []);

  const toggleItemPacked = useCallback((itemId: string) => {
    setPackedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const updatePaymentStatus = useCallback(
    (orderId: string, paymentStatus: PaymentStatus) => {
      const prescriptionId = Number(orderId);
      if (!Number.isInteger(prescriptionId)) return;
      setSettledPrescriptionIds((prev) => {
        const next = new Set(prev);
        if (paymentStatus === "SETTLED_AT_COUNTER") {
          next.add(prescriptionId);
        } else {
          next.delete(prescriptionId);
        }
        return next;
      });
    },
    [],
  );

  /** Retire a prescription the backend has confirmed as dispensed. */
  const markDispensed = useCallback((orderId: string) => {
    const prescriptionId = Number(orderId);
    setPackedItemIds(new Set<string>());
    setSettledPrescriptionIds((prev) => {
      const next = new Set(prev);
      next.delete(prescriptionId);
      return next;
    });
    setPrescriptions((prev) =>
      prev.filter((item) => item.prescriptionId !== prescriptionId),
    );
    setSelectedOrderId((current) => (current === orderId ? null : current));
    setDispensedCount((count) => count + 1);
  }, []);

  const toggleQrScanner = useCallback(() => {
    setQrOpen((prev) => !prev);
  }, []);

  const toggleBillingQr = useCallback(() => {
    setBillingQrOpen((prev) => !prev);
  }, []);

  const pendingCount = orders.filter(
    (order) =>
      order.status === "PENDING_PREPARATION" || order.status === "PREPARING",
  ).length;
  const readyCount = orders.filter(
    (order) => order.status === "READY_FOR_PICKUP",
  ).length;

  return {
    orders,
    selectedOrder,
    selectedOrderId: selectedOrder?.orderId ?? "",
    pendingCount,
    readyCount,
    /** Prescriptions dispensed during this counter shift. */
    dispensedCount,
    error,
    isRefreshing,
    qrOpen,
    billingQrOpen,
    refreshQueue,
    selectOrder,
    toggleItemPacked,
    updatePaymentStatus,
    markDispensed,
    toggleQrScanner,
    toggleBillingQr,
  };
}
