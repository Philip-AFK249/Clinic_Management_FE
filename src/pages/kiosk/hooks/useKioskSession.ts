import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { checkInPatient } from "../../../services/intakeApi";
import type {
  AdministrativeIntakeRequest,
  IntakeResponse,
  IntakeSource,
  TriagePriority,
} from "../../../services/intakeApi";
import { RECEPTION_DEPARTMENTS, SHIFT_BLOCKS, toIsoDate } from "../../reception/data/receptionMockData";
import { KIOSK_PATIENT, ROOMS, TICKET_NUMBER } from "../data/kioskMockData";
import type { KioskPatient, SymptomOption } from "../data/kioskMockData";

export type KioskStep =
  | "IDLE"
  | "QR_SCAN"
  | "CARD_OCR"
  | "SYMPTOM_TRIAGE"
  | "PRINTING_TICKET"
  | "SUCCESS_SUMMARY";

export interface KioskSelection {
  symptom: SymptomOption | null;
  viaQr: boolean;
}

/** Everything the dispensed receipt needs, whatever the source of the data. */
export interface KioskIssuedTicket {
  ticketNumber: string;
  patientName: string;
  insuranceCode: string;
  departmentId: number;
  departmentName: string;
  roomNumber: string;
  doctorName: string;
  priorityLevel: TriagePriority;
  appointmentDate: string;
  slotStartTime: string;
  checkInTime: string;
  chiefComplaint: string | null;
  /**
   * True when PatientIntakeService could not be reached and the receipt was
   * synthesized locally, so the UI can say so instead of pretending the clinic
   * queue really took the patient.
   */
  isOffline: boolean;
}

/** QR check-ins carry no triage step, so they land on the allergy department. */
const DEFAULT_DEPARTMENT_ID = 2;
const DEFAULT_PRIORITY: TriagePriority = "P3";
const SLOT_MINUTES = 60;
const SLOTS_PER_BLOCK = 4;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The 60-minute grid seeded by DoctorScheduleService: 07:30-11:30 and
 * 13:00-17:00. Kept in sync with `SHIFT_BLOCKS` from the reception data module.
 */
function buildSlotGrid(): string[] {
  const grid: string[] = [];
  for (const block of SHIFT_BLOCKS) {
    const [hours, minutes] = block.start.split(":").map(Number);
    const base = hours * 60 + minutes;
    for (let index = 0; index < SLOTS_PER_BLOCK; index += 1) {
      const total = base + index * SLOT_MINUTES;
      grid.push(`${pad2(Math.floor(total / 60))}:${pad2(total % 60)}:00`);
    }
  }
  return grid;
}

/**
 * The slot a walk-in kiosk patient belongs to: the one covering "now", else the
 * next one that has not started yet, else the last slot of the working day.
 * The backend resolves the real room/doctor from the department, so an
 * approximate-but-valid start time is enough here.
 */
export function currentSlotStartTime(reference: Date = new Date()): string {
  const grid = buildSlotGrid();
  const nowMinutes = reference.getHours() * 60 + reference.getMinutes();
  for (const start of grid) {
    const [hours, minutes] = start.split(":").map(Number);
    if (nowMinutes < hours * 60 + minutes + SLOT_MINUTES) return start;
  }
  return grid[grid.length - 1];
}

/** "14/08/1984" -> "1984-08-14"; anything unparseable becomes undefined. */
function vietnameseDateToIso(value: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function departmentNameOf(departmentId: number): string {
  return RECEPTION_DEPARTMENTS.find((d) => d.id === departmentId)?.name ?? "";
}

function ticketFromResponse(response: IntakeResponse): KioskIssuedTicket {
  return {
    ticketNumber: response.ticketNumber,
    patientName: response.patientName,
    insuranceCode: response.insuranceCode ?? KIOSK_PATIENT.insuranceCode,
    departmentId: response.departmentId,
    departmentName: response.departmentName,
    roomNumber: response.roomNumber,
    doctorName: response.doctorName,
    priorityLevel: response.priorityLevel,
    appointmentDate: response.appointmentDate,
    slotStartTime: response.slotStartTime,
    checkInTime: response.checkInTime,
    chiefComplaint: null,
    isOffline: false,
  };
}

/**
 * Stand-in receipt for when the backend is down. The kiosk is unattended, so
 * refusing to print would strand the patient at the machine; the badge in the
 * UI plus the toast make the provisional status obvious to staff.
 */
function buildFallbackTicket(
  patient: KioskPatient,
  symptom: SymptomOption | null,
  departmentId: number,
  appointmentDate: string,
  slotStartTime: string,
): KioskIssuedTicket {
  const room = symptom?.room ?? "Phòng 201";
  const doctor = ROOMS.find((r) => room.includes(r.number))?.doctor ?? "PGS. TS. BS. Trần Minh Tuấn";
  return {
    ticketNumber: TICKET_NUMBER,
    patientName: patient.patientName,
    insuranceCode: patient.insuranceCode,
    departmentId,
    departmentName: departmentNameOf(departmentId),
    roomNumber: room,
    doctorName: doctor,
    priorityLevel: symptom?.triage ?? DEFAULT_PRIORITY,
    appointmentDate,
    slotStartTime,
    checkInTime: `${appointmentDate}T${slotStartTime.slice(0, 5)}:00`,
    chiefComplaint: symptom?.label ?? null,
    isOffline: true,
  };
}

export function useKioskSession() {
  const [step, setStep] = useState<KioskStep>("IDLE");
  const [selection, setSelection] = useState<KioskSelection>({
    symptom: null,
    viaQr: false,
  });
  const [ticket, setTicket] = useState<KioskIssuedTicket | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const issueRequest = useRef<AbortController | null>(null);

  // Abort an in-flight check-in when the kiosk session ends for any reason.
  useEffect(() => () => issueRequest.current?.abort(), []);

  const startQrScan = useCallback(() => {
    setSelection({ symptom: null, viaQr: true });
    setStep("QR_SCAN");
  }, []);

  const startCardOcr = useCallback(() => {
    setSelection({ symptom: null, viaQr: false });
    setStep("CARD_OCR");
  }, []);

  const selectSymptom = useCallback((symptom: SymptomOption) => {
    setSelection((prev) => ({ ...prev, symptom }));
  }, []);

  /**
   * Dispatches the patient to PatientIntakeService (:8082) so the kiosk receipt
   * carries the number, room and doctor the rest of the clinic will act on.
   */
  const issueTicket = useCallback(async () => {
    issueRequest.current?.abort();
    const controller = new AbortController();
    issueRequest.current = controller;

    const patient = KIOSK_PATIENT;
    const symptom = selection.symptom;
    const viaQr = selection.viaQr;
    const departmentId = symptom?.departmentId ?? DEFAULT_DEPARTMENT_ID;
    const appointmentDate = toIsoDate(new Date());
    const slotStartTime = currentSlotStartTime();
    const intakeSource: IntakeSource = viaQr ? "KIOSK_QR" : "KIOSK_OCR";

    const payload: AdministrativeIntakeRequest = {
      fullName: patient.patientName.trim(),
      // The kiosk reads a BHYT card or a QR booking, never a bare CCCD.
      insuranceCode: patient.insuranceCode.trim() || undefined,
      initialHospitalCode: patient.initialHospitalCode.trim() || undefined,
      dateOfBirth: vietnameseDateToIso(patient.dob),
      gender: patient.gender,
      isOcrVerified: intakeSource === "KIOSK_OCR",
      departmentId,
      departmentName: departmentNameOf(departmentId),
      appointmentDate,
      slotStartTime,
      priorityLevel: symptom?.triage ?? DEFAULT_PRIORITY,
      intakeSource,
      chiefComplaint: symptom?.label,
    };

    setIsIssuing(true);
    setIssueError("");
    try {
      const response = await checkInPatient(payload, controller.signal);
      if (controller.signal.aborted) return;
      setTicket(ticketFromResponse(response));
    } catch (cause) {
      if (controller.signal.aborted) return;
      const message =
        cause instanceof Error ? cause.message : "Không liên hệ được dịch vụ tiếp nhận.";
      setIssueError(message);
      toast.error(
        `${message} Đang in phiếu tạm, vui lòng đến quầy tiếp đón để được ghi nhận chính thức.`,
        { duration: 8000 },
      );
      setTicket(
        buildFallbackTicket(patient, symptom, departmentId, appointmentDate, slotStartTime),
      );
    } finally {
      if (!controller.signal.aborted) setIsIssuing(false);
    }
  }, [selection]);

  const handleQrMatched = useCallback(() => {
    setStep("PRINTING_TICKET");
    void issueTicket();
  }, [issueTicket]);

  const proceedToPrint = useCallback(() => {
    setStep("PRINTING_TICKET");
    void issueTicket();
  }, [issueTicket]);

  const handleCardOcrComplete = useCallback(() => {
    setStep("SYMPTOM_TRIAGE");
  }, []);

  const handleTicketIssued = useCallback(() => {
    setStep("SUCCESS_SUMMARY");
  }, []);

  const reset = useCallback(() => {
    issueRequest.current?.abort();
    issueRequest.current = null;
    setSelection({ symptom: null, viaQr: false });
    setTicket(null);
    setIsIssuing(false);
    setIssueError("");
    setStep("IDLE");
  }, []);

  return {
    step,
    selection,
    patient: KIOSK_PATIENT,
    ticket,
    isIssuing,
    issueError,
    startQrScan,
    startCardOcr,
    handleQrMatched,
    handleCardOcrComplete,
    selectSymptom,
    proceedToPrint,
    handleTicketIssued,
    reset,
  };
}
