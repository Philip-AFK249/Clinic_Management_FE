import type {
  DiagnosisItem,
  PrescriptionItemPayload,
} from "../../../services/clinicalApi";
import type { DrugDto } from "../../../services/clinicalApi";
import type {
  BhyCoverage,
  IcdCode,
  RxLine,
  RxSeed,
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
 * Turn the AI's proposal into real prescription lines.
 *
 * Seeds whose drug is absent from (or inactive in) the live catalog are dropped:
 * the backend rejects the whole prescription with a 400 as soon as one
 * `drugId` does not resolve, so keeping an unresolved line would block the
 * doctor from signing the encounter at all.
 */
export function resolveRxSeeds(
  seeds: RxSeed[],
  drugs: DrugDto[],
): RxLine[] {
  const resolved: RxLine[] = [];
  seeds.forEach((seed, index) => {
    const drug = findDrug(drugs, seed.drugName);
    if (!drug) return;
    resolved.push({
      ...drugToRxLine(drug, `RX-AI-${index + 1}`),
      routeFrequency: seed.routeFrequency,
      duration: seed.duration,
      quantity: seed.quantity,
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
