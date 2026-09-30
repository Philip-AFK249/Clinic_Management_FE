import type {
  DrugDto,
  PrescriptionDetailResponse,
  PrescriptionStatus as ApiPrescriptionStatus,
} from "../../../services/clinicalApi";
import type {
  MedicationItem,
  PharmacyOrder,
  PrescriptionStatus,
} from "./pharmacyTypes";

/**
 * Projects `PrescriptionDetailResponse` onto the pharmacy view model.
 *
 * Two mappings deserve attention:
 *  - The prescription API stores no demographics, room or allergy list, so
 *    those become `null` / `[]` and the cards say "chưa có dữ liệu" instead of
 *    inventing them.
 *  - `bhytCoveragePercent` lives on the `drugs` row, not on the prescription
 *    line, so it is joined back from the live catalog by `drugId`. Without the
 *    join every line would look self-paid and the billing breakdown would lie.
 */

const STATUS_MAP: Record<ApiPrescriptionStatus, PrescriptionStatus> = {
  PENDING_DISPENSE: "PENDING_PREPARATION",
  DISPENSING: "PREPARING",
  DISPENSED: "DISPENSED",
  CANCELLED: "CANCELLED",
};

const COVERAGE_PERCENT: Record<DrugDto["bhytCoverage"], number> = {
  BHYT_80: 80,
  BHYT_100: 100,
  SELF_PAY: 0,
};

/**
 * Rate used when the catalog could not be loaded: the line reads as self-paid,
 * a pessimistic label, while the billing card still quotes the server-computed
 * totals. Better a cautious line than a wrong "BHYT 100%" claim.
 */
const UNKNOWN_COVERAGE_PERCENT = 0;

/** "HH:mm" from the ISO timestamp the service serialises `LocalDateTime` to. */
function toClock(iso: string | undefined): string {
  const match = /T(\d{2}:\d{2})/.exec(iso ?? "");
  return match ? match[1] : "--:--";
}

/** Display unit derived from the dosage form, which is drug master data. */
function unitFor(dosageForm: string): string {
  const form = dosageForm.toLowerCase();
  if (
    form.includes("capsule") ||
    form.includes("tablet") ||
    form.includes("pill")
  ) {
    return "viên";
  }
  if (form.includes("syrup") || form.includes("suspension")) return "lọ";
  if (form.includes("injection") || form.includes("infusion")) return "ống";
  if (form.includes("spray") || form.includes("inhaler")) return "bình";
  if (form.includes("cream") || form.includes("ointment")) return "tuýp";
  return "đơn vị";
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** "Amoxicillin" + "500mg" -> "Amoxicillin 500mg". */
function drugLabel(name: string, concentration: string): string {
  const strength = concentration.trim();
  if (!strength || name.toLowerCase().includes(strength.toLowerCase())) {
    return name;
  }
  return `${name} ${strength}`;
}

function toItem(
  item: PrescriptionDetailResponse["items"][number],
  drug: DrugDto | undefined,
  isPacked: boolean,
): MedicationItem {
  const instructions = [item.routeFrequency, item.duration]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" - ");

  return {
    id: String(item.itemId),
    name: drugLabel(item.drugName, item.concentration),
    activeIngredient: item.drugName,
    dosageForm: item.dosageForm,
    instructions: instructions || "Theo chỉ định của bác sĩ",
    quantity: toNumber(item.quantity),
    unit: unitFor(item.dosageForm),
    unitPrice: toNumber(item.unitPrice),
    bhytCoveragePercent: drug
      ? (COVERAGE_PERCENT[drug.bhytCoverage] ?? UNKNOWN_COVERAGE_PERCENT)
      : UNKNOWN_COVERAGE_PERCENT,
    stockUnits: toNumber(item.currentStock),
    isPacked,
    isAllergyRisk: false,
  };
}

export interface PrescriptionMapperOptions {
  /** `drugs.id -> DrugDto`, used to recover the per-line BHYT rate. */
  drugsById?: Map<number, DrugDto>;
  /** Locally checked-off lines, keyed by `itemId`. */
  packedItemIds?: ReadonlySet<string>;
  /** Settled at the counter, keyed by `prescriptionId`. */
  settledPrescriptionIds?: ReadonlySet<number>;
}

export function toPharmacyOrder(
  prescription: PrescriptionDetailResponse,
  options: PrescriptionMapperOptions = {},
): PharmacyOrder {
  const { drugsById, packedItemIds, settledPrescriptionIds } = options;

  const items = prescription.items.map((item) =>
    toItem(
      item,
      drugsById?.get(item.drugId),
      packedItemIds?.has(String(item.itemId)) ?? false,
    ),
  );

  const backendStatus = STATUS_MAP[prescription.status] ?? "PENDING_PREPARATION";
  const allPacked = items.length > 0 && items.every((item) => item.isPacked);
  // Counter-side progress only: DISPENSED / CANCELLED are owned by the backend.
  const status =
    allPacked && backendStatus !== "DISPENSED" && backendStatus !== "CANCELLED"
      ? "READY_FOR_PICKUP"
      : backendStatus;

  return {
    orderId: String(prescription.prescriptionId),
    encounterId: String(prescription.encounterId),
    ticketCode: prescription.ticketNumber,
    patientName: prescription.patientName,
    patientId: String(prescription.patientId),
    dob: null,
    age: null,
    gender: null,
    insuranceCode: prescription.insuranceCode ?? null,
    initialHospitalCode: null,
    isOcrVerified: Boolean(prescription.insuranceCode),
    allergies: [],
    prescribingDoctor: prescription.doctorName,
    roomNumber: null,
    diagnosis: null,
    createdAt: toClock(prescription.createdAt),
    status,
    paymentStatus: settledPrescriptionIds?.has(prescription.prescriptionId)
      ? "SETTLED_AT_COUNTER"
      : "PENDING_AT_COUNTER",
    items,
    totalAmount: toNumber(prescription.totalAmount),
    insurancePaidAmount: toNumber(prescription.insurancePaidAmount),
    patientCopayAmount: toNumber(prescription.patientCopayAmount),
  };
}
