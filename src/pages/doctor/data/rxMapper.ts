import type {
  DiagnosisItem,
  PrescriptionDraftItem,
  PrescriptionItemPayload,
} from "../../../services/clinicalApi";
import type { DrugDto } from "../../../services/clinicalApi";
import type {
  BhyCoverage,
  IcdCode,
  RxLine,
} from "./doctorMockData";

/**
 * Bridges the live pharmacy catalog (`GET /pharmacy/drugs`) and the EHR's
 * prescribing table. Everything a prescription line shows - name, dosage form,
 * stock, BHYT rate, penicillin flag - is projected from the fetched `drugs`
 * row so the UI can never disagree with what the backend will dispense.
 */

const BHYT_LABELS: Record<DrugDto["bhytCoverage"], BhyCoverage> = {
  BHYT_80: "BHYT 80%",
  BHYT_100: "BHYT 100%",
  SELF_PAY: "Tự túc",
};

/**
 * A neutral signature the doctor can edit. The catalog carries no default
 * sig, so it is derived from the dosage form (which does come from the drug)
 * rather than hardcoded per drug.
 */
function defaultSigFor(dosageForm: string): { frequency: string; duration: string } {
  const form = dosageForm.toLowerCase();
  if (form.includes("capsule") || form.includes("tablet") || form.includes("pill")) {
    return { frequency: "1 viên x 2 lần/ngày sau ăn", duration: "5 ngày" };
  }
  if (form.includes("syrup") || form.includes("suspension")) {
    return { frequency: "5 ml x 2 lần/ngày", duration: "5 ngày" };
  }
  if (form.includes("injection") || form.includes("infusion")) {
    return { frequency: "1 ống/ngày", duration: "3 ngày" };
  }
  if (form.includes("spray") || form.includes("inhaler")) {
    return { frequency: "2 nhịp x 2 lần/ngày", duration: "7 ngày" };
  }
  return { frequency: "2 lần/ngày", duration: "5 ngày" };
}

/** "Amoxicillin" + "500mg" -> "Amoxicillin 500mg". */
export function drugDisplayName(drug: DrugDto): string {
  const concentration = drug.concentration.trim();
  if (!concentration) return drug.name;
  return drug.name.toLowerCase().includes(concentration.toLowerCase())
    ? drug.name
    : `${drug.name} ${concentration}`;
}

/** A brand new line for a drug the doctor just picked from the catalog. */
export function drugToRxLine(drug: DrugDto, id: string): RxLine {
  return {
    id,
    drugId: drug.id,
    medication: drugDisplayName(drug),
    dosageForm: drug.dosageForm,
    routeFrequency: defaultSigFor(drug.dosageForm).frequency,
    duration: defaultSigFor(drug.dosageForm).duration,
    quantity: 1,
    stockUnits: drug.stockQuantity,
    bhytCoverage: BHYT_LABELS[drug.bhytCoverage] ?? "Tự túc",
    isPenicillinClass: drug.isPenicillinClass,
  };
}

function findDrug(drugs: DrugDto[], drugName: string): DrugDto | undefined {
  const wanted = drugName.trim().toLowerCase();
  return drugs.find(
    (drug) =>
      drug.name.trim().toLowerCase() === wanted ||
      drugDisplayName(drug).toLowerCase() === wanted,
  );
}

/**
 * Resolve an AI Gateway draft line by drug name, tolerating the concentration
 * the model appends to the name ("Amoxicillin 500mg") being split across
 * `drug_name` and `concentration` instead.
 */
function findDrugLoose(
  drugs: DrugDto[],
  drugName: string,
  concentration?: string | null,
): DrugDto | undefined {
  const direct = findDrug(drugs, drugName);
  if (direct) return direct;

  const wanted = drugName.trim().toLowerCase();
  const conc = (concentration ?? "").trim().toLowerCase();
  if (!conc) return undefined;

  const combined = `${wanted} ${conc}`.replace(/\s+/g, " ");
  return drugs.find((drug) => {
    const display = drugDisplayName(drug).toLowerCase().replace(/\s+/g, " ");
    if (display === combined) return true;
    return (
      drug.name.trim().toLowerCase() === wanted &&
      drug.concentration.trim().toLowerCase().startsWith(conc)
    );
  });
}

/**
 * Turn the AI Gateway's prescription draft into real prescription lines.
 *
 * Stock, BHYT coverage and the penicillin flag always come from the live
 * catalog, never from the draft: the kho moves while the doctor writes, and the
 * backend checks the real `drugs` row when the prescription is dispensed. Lines
 * whose drug is absent from the formulary are dropped rather than sent with an
 * unusable `drugId`, which the backend would reject with a 400 for the whole
 * prescription.
 */
export function resolvePrescriptionDraft(
  items: PrescriptionDraftItem[],
  drugs: DrugDto[],
): RxLine[] {
  const resolved: RxLine[] = [];
  items.forEach((item, index) => {
    if (!item?.drug_name?.trim()) return;
    const drug = findDrugLoose(drugs, item.drug_name, item.concentration);
    if (!drug) return;

    const line = drugToRxLine(drug, `RX-DRAFT-${index + 1}`);
    resolved.push({
      ...line,
      routeFrequency: item.route_frequency?.trim() || line.routeFrequency,
      duration: item.duration?.trim() || line.duration,
      quantity:
        Number.isFinite(item.quantity) && item.quantity > 0
          ? Math.trunc(item.quantity)
          : line.quantity,
    });
  });
  return resolved;
}

/**
 * The wire payload for `POST /clinical/encounters/{id}/complete`. Lines whose
 * drug id is unusable are skipped rather than sent as `drugId: 0`, which the
 * backend would reject with a 400 for the entire prescription.
 */
export function toPrescriptionItems(
  rxLines: RxLine[],
): PrescriptionItemPayload[] {
  return rxLines
    .filter(
      (line): line is RxLine & { drugId: number } =>
        Number.isInteger(line.drugId) && line.drugId > 0,
    )
    .map((line) => ({
      drugId: line.drugId,
      quantity: Math.max(1, Math.trunc(line.quantity) || 1),
      routeFrequency: line.routeFrequency,
      duration: line.duration,
    }));
}

/**
 * Accepted ICD-10 codes -> `diagnoses`. The backend requires at least one and
 * honours `isPrimary` when printing the bệnh án, so the first accepted code
 * (the doctor's primary pick) is flagged as such.
 */
export function toDiagnoses(icdAccepted: IcdCode[]): DiagnosisItem[] {
  return icdAccepted.map((code, index) => ({
    icd10Code: code.code,
    diseaseName: code.label,
    isPrimary: index === 0,
    aiConfidence: code.confidence > 0 ? code.confidence : undefined,
  }));
}
