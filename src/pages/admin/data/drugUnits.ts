/**
 * Dispensing units shared by the create/edit drug forms.
 *
 * `concentration` says how strong the medicine is ("500mg", "100ml"); `unit`
 * says what the pharmacy actually hands over ("Viên", "Lọ", "Ống"). Keeping the
 * list in one place stops the two modals from drifting apart.
 */
export const DRUG_UNIT_OPTIONS = [
  "Viên",
  "Lọ",
  "Ống",
  "Gói",
  "Chai",
  "Tuýp",
  "Bình",
  "ml",
] as const;

/** Dosage form -> the unit a pharmacy normally dispenses it in. */
export function suggestDrugUnit(dosageForm: string): string {
  const form = dosageForm.trim().toLowerCase();
  if (!form) return "";
  if (form.includes("bột")) return "Gói";
  if (form.includes("ống tiêm")) return "Ống";
  if (
    form.includes("siro") ||
    form.includes("dung dịch") ||
    form.includes("nhũ tương")
  ) {
    return "Lọ";
  }
  if (form.includes("bình xịt")) return "Bình";
  if (form.includes("kem") || form.includes("mỡ")) return "Tuýp";
  if (form.includes("viên nén") || form.includes("viên nang")) return "Viên";
  return "";
}
