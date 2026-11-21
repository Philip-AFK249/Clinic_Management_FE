import type {
  IntakeResponse,
  PaymentStatus,
  QueueStatus,
  QueueTicket,
  TriagePriority,
} from "../../services/intakeApi";
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
  /** Last queue state, when the source carries it (post-check-in answers do). */
  status?: QueueStatus;
  receiptNumber?: string | null;
  receiptAmount?: number | null;
  isReceiptVerified?: boolean;
  /** Deposit / admin-oversight columns for temporary online reservations. */
  paymentStatus?: PaymentStatus | null;
  paymentCode?: string | null;
  depositAmount?: number | null;
  paidAmount?: number | null;
  paymentExpiresAt?: string | null;
  paidAt?: string | null;
  externalTxId?: string | null;
  adminNote?: string | null;
  qrUrl?: string | null;
}

/**
 * True while a ticket is only holding its slot for an unpaid deposit. The
 * payment status is a fallback for older responses that omitted `status`.
 */
export function isAwaitingDeposit(view: TicketView): boolean {
  if (view.status) return view.status === "PENDING_PAYMENT";
  return view.paymentStatus === "UNPAID";
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
    status: response.status,
    receiptNumber: response.receiptNumber,
    receiptAmount: response.receiptAmount,
    isReceiptVerified: response.isReceiptVerified,
    paymentStatus: response.paymentStatus,
    paymentCode: response.paymentCode,
    depositAmount: response.depositAmount,
    paidAmount: response.paidAmount,
    paymentExpiresAt: response.paymentExpiresAt,
    paidAt: response.paidAt,
    externalTxId: response.externalTxId,
    adminNote: response.adminNote,
    qrUrl: response.qrUrl,
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
    status: ticket.status,
    receiptNumber: ticket.receiptNumber,
    receiptAmount: ticket.receiptAmount,
    isReceiptVerified: ticket.isReceiptVerified,
    paymentStatus: ticket.paymentStatus,
    paymentCode: ticket.paymentCode,
    depositAmount: ticket.depositAmount,
    paidAmount: ticket.paidAmount,
    paymentExpiresAt: ticket.paymentExpiresAt,
    paidAt: ticket.paidAt,
    externalTxId: ticket.externalTxId,
    adminNote: ticket.adminNote,
    qrUrl: ticket.qrUrl,
  };
}
