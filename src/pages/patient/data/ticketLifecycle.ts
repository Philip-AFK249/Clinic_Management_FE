import { toast } from "sonner";
import type { QueueStatus, QueueTicketDetailResponse } from "../../../services/intakeApi";
import type { ActiveAppointment } from "./patientMockRecords";

/** Patient-facing labels shared by the booking page and the dashboard. */
export const TEMPORARY_PENDING_LABEL = "Vé tạm thời — Chờ xác thực";
export const PAID_PENDING_LABEL = "Đã thanh toán — Chờ Admin duyệt";
export const OFFICIAL_TICKET_LABEL = "VÉ ONLINE CHÍNH THỨC";
export const OFFICIAL_TICKET_CONFIRMED = "ĐÃ XÁC NHẬN";
export const OFFICIAL_TICKET_BADGE = "Vé online chính thức (Đã xác nhận)";
export const NO_CANCEL_POLICY_NOTICE =
  "Vé đã xác nhận chính thức lên hệ thống. Theo quy định phòng khám, không cho phép hủy lịch và không hoàn phí nếu không đến khám.";

export const BOOKING_CREATED_TOAST =
  "Đã tạo vé online tạm thời. Vui lòng thanh toán và chờ xác thực.";
export const TICKET_ACCEPTED_TOAST =
  "Vé khám đã được Admin duyệt thành VÉ ONLINE CHÍNH THỨC!";
export const TICKET_REJECTED_TOAST = "Vé online tạm thời đã bị từ chối xác thực.";
export const PAYMENT_SUCCESS_TOAST =
  "Đã ghi nhận thanh toán. Vé của bạn đang chờ Admin duyệt.";

/** Temporary ticket: it holds a seat but is not official yet. */
export function isTemporaryStatus(status: QueueStatus | null | undefined): boolean {
  return status === "PENDING_CONFIRMATION";
}

/** A status that still belongs to a queue/visit after admin confirmation. */
export function isQueuedStatus(status: QueueStatus | null | undefined): boolean {
  return status === "WAITING" || status === "CALLED" || status === "IN_CONSULTATION";
}

/** A status after which no further polling is useful. */
export function isTerminalStatus(status: QueueStatus | null | undefined): boolean {
  return (
    status === "COMPLETED" ||
    status === "CANCELLED" ||
    status === "SKIPPED" ||
    status === "REJECTED"
  );
}

/** Once confirmed, a ticket can no longer be cancelled or refunded. */
export function isConfirmedTicket(status: QueueStatus | null | undefined): boolean {
  return isQueuedStatus(status) || status === "COMPLETED";
}

/** Whole seconds left before an absolute deadline; never negative. */
export function secondsUntil(deadlineMs: number | null): number {
  if (deadlineMs === null) return 0;
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
}

/** `MM:SS` with a minimum of two digits per part. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const remainder = String(safe % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

/** Backend detail wins over the cached copy for every lifecycle field. */
export function applyTicketDetail(
  appointment: ActiveAppointment,
  detail: QueueTicketDetailResponse | null | undefined,
): ActiveAppointment {
  if (!detail) return appointment;
  return {
    ...appointment,
    status: detail.status,
    expiresAt: detail.expiresAt ?? appointment.expiresAt ?? null,
    confirmedAt: detail.confirmedAt ?? appointment.confirmedAt ?? null,
    confirmedBy: detail.confirmedBy ?? appointment.confirmedBy ?? null,
    rejectionReason: detail.rejectionReason ?? appointment.rejectionReason ?? null,
    canCancel: detail.canCancel ?? appointment.canCancel,
    isTemporary:
      detail.isTemporary ??
      appointment.isTemporary ??
      detail.status === "PENDING_CONFIRMATION",
    isReceiptVerified: detail.isReceiptVerified ?? appointment.isReceiptVerified ?? false,
    paidAt: detail.paidAt ?? appointment.paidAt ?? null,
    paymentMethod: detail.paymentMethod ?? appointment.paymentMethod ?? null,
    bookedAt: detail.checkInTime ?? appointment.bookedAt ?? null,
  };
}

/** Stable toast ids stop a 3-second poll from stacking duplicate messages. */
export function notifyTicketAccepted(ticketNumber: string): void {
  toast.success(TICKET_ACCEPTED_TOAST, {
    id: `ticket-accepted-${ticketNumber}`,
    duration: 6000,
  });
}

export function notifyTicketRejected(ticketNumber: string, reason?: string | null): void {
  const suffix = reason?.trim() ? ` Lý do: ${reason.trim()}` : "";
  toast.error(`${TICKET_REJECTED_TOAST}${suffix}`, {
    id: `ticket-rejected-${ticketNumber}`,
    duration: 8000,
  });
}
