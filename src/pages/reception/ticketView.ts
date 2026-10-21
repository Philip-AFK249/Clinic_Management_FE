import type { IntakeResponse, QueueTicket, TriagePriority } from "../../services/intakeApi";
import { patientsAhead as countPatientsAhead } from "../../services/intakeApi";

/** Presentation-agnostic projection of either an intake receipt or a queue ticket. */
export interface TicketView {
  ticketNumber: string;
  patientName: string;
  insuranceCode: string | null;
  identityCardNumber: string | null;
  departmentName: string;
  /** Co-consult clinic for a multi-organ ticket; absent on a normal one. */
  secondaryDepartmentId?: number | null;
  secondaryDepartmentName?: string | null;
  multiSpecialtyNote?: string | null;
  doctorName: string;
  roomNumber: string;
  appointmentDate: string;
  slotStartTime: string;
  priorityLevel: TriagePriority;
  checkInTime: string | null;
  patientsAhead: number;
}

export function ticketViewFromIntake(
  response: IntakeResponse,
  queue: QueueTicket[],
): TicketView {
  const before = queue.filter(
    (ticket) =>
      ticket.departmentId === response.departmentId &&
      ticket.status === "WAITING",
  ).length;
  return {
    ticketNumber: response.ticketNumber,
    patientName: response.patientName,
    insuranceCode: response.insuranceCode,
    identityCardNumber: null,
    departmentName: response.departmentName,
    secondaryDepartmentId: response.secondaryDepartmentId,
    secondaryDepartmentName: response.secondaryDepartmentName,
    multiSpecialtyNote: response.multiSpecialtyNote,
    doctorName: response.doctorName,
    roomNumber: response.roomNumber,
    appointmentDate: response.appointmentDate,
    slotStartTime: response.slotStartTime,
    priorityLevel: response.priorityLevel,
    checkInTime: response.checkInTime,
    patientsAhead: before,
  };
}

export function ticketViewFromQueue(
  ticket: QueueTicket,
  queue: QueueTicket[],
): TicketView {
  return {
    ticketNumber: ticket.ticketNumber,
    patientName: ticket.patient?.fullName ?? "Không rõ họ tên",
    insuranceCode: ticket.patient?.insuranceCode ?? null,
    identityCardNumber: ticket.patient?.identityCardNumber ?? null,
    departmentName: ticket.departmentName,
    secondaryDepartmentId: ticket.secondaryDepartmentId,
    secondaryDepartmentName: ticket.secondaryDepartmentName,
    multiSpecialtyNote: ticket.multiSpecialtyNote,
    doctorName: ticket.doctorName,
    roomNumber: ticket.roomNumber,
    appointmentDate: ticket.appointmentDate,
    slotStartTime: ticket.slotStartTime,
    priorityLevel: ticket.priorityLevel,
    checkInTime: ticket.checkInTime,
    patientsAhead: countPatientsAhead(ticket, queue),
  };
}
