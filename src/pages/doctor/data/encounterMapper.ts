import type { PatientEncounterDto } from "../../../services/clinicalApi";
import type { PastEncounter, PatientRecord } from "./doctorMockData";

/** `yyyy-MM-dd` (or ISO datetime) as `dd/MM/yyyy`. */
export function formatEncounterDate(
  encounter: Pick<PatientEncounterDto, "encounterDate" | "createdAt">,
): string {
  const iso = encounter.encounterDate || encounter.createdAt || "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "--/--/----";
}

/** The diagnosis the encounter marked primary, falling back to the first row. */
export function primaryDiagnosisOf(encounter: PatientEncounterDto) {
  const diagnoses = encounter.diagnoses ?? [];
  return diagnoses.find((diagnosis) => diagnosis.isPrimary) ?? diagnoses[0] ?? null;
}

/** `L20 - Viêm da cơ địa`, or a neutral placeholder for an unsigned note. */
export function encounterDiagnosisLabel(encounter: PatientEncounterDto): string {
  const diagnosis = primaryDiagnosisOf(encounter);
  if (!diagnosis?.icd10Code) return "Chưa có chẩn đoán";
  return `${diagnosis.icd10Code} - ${diagnosis.diseaseName}`;
}

/** One historical encounter in the shape `PatientHistoryModal` already renders. */
export function encounterToPastEncounter(
  encounter: PatientEncounterDto,
): PastEncounter {
  const sections = [encounter.objective, encounter.assessment, encounter.plan]
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section));

  return {
    id: `ENC-${encounter.encounterId}`,
    date: formatEncounterDate(encounter),
    department: "Ca khám đã hoàn tất",
    complaint:
      encounter.subjective?.trim() || "Bệnh nhân không ghi nhận triệu chứng.",
    diagnosis: encounterDiagnosisLabel(encounter),
    notes:
      sections.join(" · ") ||
      "Bác sĩ chưa ghi thêm mô tả khách quan / đánh giá / hướng xử trí.",
  };
}

/** Local clock label for the re-examination patient, e.g. "14:35". */
function currentClock(): string {
  return new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Build the `PatientRecord` the EHR workspace renders from an encounter the
 * doctor already signed. Used by "Khám lại": the chart opens on today's fresh
 * encounter, and the previous visits ride along as `pastEncounters` for the
 * copilot and the history panel.
 *
 * `allEncounters` is the doctor's full history, filtered here to the same
 * patient so the returned record carries that patient's complete timeline.
 */
export function encounterToPatientRecord(
  encounter: PatientEncounterDto,
  allEncounters: PatientEncounterDto[],
  ticketNumber?: string,
): PatientRecord {
  const patientHistory = allEncounters
    .filter((item) => item.patientId === encounter.patientId)
    .sort((a, b) => {
      const byDate = (b.encounterDate ?? "").localeCompare(a.encounterDate ?? "");
      return byDate !== 0
        ? byDate
        : (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    })
    .map(encounterToPastEncounter);

  return {
    ticketNumber: ticketNumber ?? encounter.ticketNumber,
    name: encounter.patientName,
    // Same human-facing label convention as `ticketToPatientRecord`.
    patientId: `FHIR-P-${encounter.patientId}`,
    dob: "--/--/----",
    age: 0,
    gender: "Khác",
    insuranceCode: "Chưa cập nhật",
    initialHospitalCode: "Chưa rõ nơi KCB",
    isOcrVerified: false,
    arrivalTime: currentClock(),
    waitingMinutes: 0,
    chiefComplaint:
      encounter.subjective?.trim() || "Khám lại theo lịch sử điều trị.",
    source: "Quầy tiếp đón",
    triage: "P3",
    priorityScore: 60,
    disclaimerAccepted: false,
    // Encounter history carries no allergy columns; flagged so the banner asks
    // the patient rather than claiming "no known allergies".
    allergies: [],
    allergiesKnown: false,
    vitals: { bp: "", hr: 0, temp: "", spo2: 0 },
    vitalsRecorded: false,
    pastEncounters: patientHistory,
    labReports: [],
    scannedOldPrescriptions: [],
  };
}
