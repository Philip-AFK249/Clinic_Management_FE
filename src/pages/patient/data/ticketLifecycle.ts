import { toast } from "sonner";
import type { QueueStatus, QueueTicketDetailResponse } from "../../../services/intakeApi";
import type { ActiveAppointment } from "./patientMockRecords";

/** The clinic's temporary online-ticket hold, in seconds. */
export const TEMPORARY_HOLD_SECONDS = 180;
export const TEMPORARY_HOLD_MS = TEMPORARY_HOLD_SECONDS * 1000;

/** Exact patient-facing copy shared by the ticket modal and the dashboard. */
export const TEMPORARY_TICKET_BANNER =
  "VÉ ONLINE TẠM THỜI — CHỜ ADMIN XÁC THỰC";
export const TEMPORARY_HOLD_NOTICE =
  "Suất khám đang được giữ tạm thời. Nếu quá 03:00 chưa được xác nhận/thanh toán, hệ thống sẽ tự động hủy vé để nhường chỗ cho người khác.";
export const OFFICIAL_TICKET_LABEL = "VÉ ONLINE CHÍNH THỨC";
export const OFFICIAL_TICKET_CONFIRMED = "ĐÃ XÁC NHẬN";
export const NO_CANCEL_POLICY_NOTICE =
  "Vé đã xác nhận chính thức lên hệ thống. Theo quy định phòng khám, không cho phép hủy lịch và không hoàn phí nếu không đến khám.";

export const TICKET_ACCEPTED_TOAST =
  "Vé khám đã được xác thực thành VÉ ONLINE CHÍNH THỨC!";
export const TICKET_REJECTED_TOAST = "Vé online tạm thời đã bị từ chối xác thực.";
export const TICKET_EXPIRED_TOAST =
  "Đã hết thời hạn 3 phút giữ chỗ. Vé tạm thời đã tự động hủy để nhường suất khám.";

/** Temporary ticket: it holds a seat but is not official yet. */
export function isTemporaryStatus(status: QueueStatus | null | undefined): boolean {
  return status === "PENDING_CONFIRMATION";
}

/** A status that still belongs to a queue/visit after admin confirmation. */
export function isQueuedStatus(status: QueueStatus | null | undefined): boolean {
  return (
    status === "WAITING" ||
    status === "CALLED" ||
    status === "IN_CONSULTATION"
  );
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

function parseDate(value: string | null | undefined): number | null {
  if (!value || typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Absolute expiry timestamp of a temporary hold.
 *
 * Prefers the backend's `expiresAt`; the fallback is 3 minutes from the instant
 * the booking was created, so an older service response without the new field
 * still gives the patient the same 03:00 deadline after a reload.
 */
export function resolveHoldDeadline(
  expiresAt: string | null | undefined,
  bookedAt: string | null | undefined,
): number | null {
  const exact = parseDate(expiresAt);
  if (exact !== null) return exact;
  const start = parseDate(bookedAt);
  return start === null ? null : start + TEMPORARY_HOLD_MS;
}

/** Whole seconds left before a deadline; never negative. */
export function secondsUntil(deadlineMs: number | null): number {
  if (deadlineMs === null) return TEMPORARY_HOLD_SECONDS;
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
}

/** `MM:SS` with a minimum of two digits per part. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const remainder = String(safe % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function isHoldExpired(
  expiresAt: string | null | undefined,
  bookedAt: string | null | undefined,
): boolean {
  const deadline = resolveHoldDeadline(expiresAt, bookedAt);
  return deadline !== null && Date.now() >= deadline;
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

export function notifyTicketExpired(ticketNumber: string): void {
  toast.error(TICKET_EXPIRED_TOAST, {
    id: `ticket-expired-${ticketNumber}`,
    duration: 8000,
  });
}
