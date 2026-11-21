import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  Ban,
  CalendarX,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  HeartPulse,
  Loader2,
  Pill,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useAuth } from "../../context/useAuth";
import { cancelTicketApi, payOnlineTicketApi } from "../../services/intakeApi";
import type { QueueStatus, QueueTicketDetailResponse } from "../../services/intakeApi";
import type {
  EncounterStatus,
  PatientEncounterDto,
  PrescriptionStatus,
} from "../../services/clinicalApi";
import PatientNavbar from "./components/PatientNavbar";
import PatientFooter from "./components/PatientFooter";
import {
  appointmentFromTicketDetail,
  clearActiveBooking,
  isAppointmentDateExpired,
  isStoredBookingExpired,
  readOwnedActiveBooking,
  syncActiveBooking,
} from "./data/activeBooking";
import {
  formatCountdown,
  isConfirmedTicket,
  isTemporaryStatus,
  NO_CANCEL_POLICY_NOTICE,
  OFFICIAL_TICKET_CONFIRMED,
  OFFICIAL_TICKET_LABEL,
  OFFICIAL_TICKET_BADGE,
  PAID_PENDING_LABEL,
  PAYMENT_SUCCESS_TOAST,
  TEMPORARY_PENDING_LABEL,
} from "./data/ticketLifecycle";
import { identifierCandidates } from "./data/patientIdentifiers";
import {
  encounterKey,
  loadPatientEncounters,
} from "./data/patientEncounterLoader";
import { usePatientTicket } from "./hooks/usePatientTicket";
import { useBookingLock } from "./hooks/useBookingLock";
import PaymentConfirmationModal from "./components/PaymentConfirmationModal";

type DashboardTab = "queue" | "records";

/** `yyyy-MM-dd` (what the intake service stores) as the `dd/MM/yyyy` we print. */
function dateLabelFrom(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * Queue status as the patient should read it.
 *
 * Every state the backend can report is listed, including the two terminal
 * ones the live poll can still return via the stored ticket number - a screen
 * that blanks out because a visit ended would look like an outage.
 */
const STATUS_BADGES: Record<
  QueueStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  PENDING_CONFIRMATION: {
    label: TEMPORARY_PENDING_LABEL,
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock,
  },
  REJECTED: {
    label: "Bị từ chối xác thực",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: Ban,
  },
  WAITING: {
    label: OFFICIAL_TICKET_BADGE,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  CALLED: {
    label: "Đã được gọi",
    className: "border-clinical-200 bg-clinical-50 text-clinical-700",
    icon: CheckCircle2,
  },
  IN_CONSULTATION: {
    label: "Đang khám",
    className: "border-teal-200 bg-teal-50 text-teal-700",
    icon: CheckCircle2,
  },
  COMPLETED: {
    label: "Đã hoàn tất khám",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  SKIPPED: {
    label: "Đã bỏ lỡ",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: Clock,
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: Clock,
  },
};

const FINISHED_NOTICES: Record<QueueStatus, string> = {
  COMPLETED:
    "Phiếu khám của bạn đã hoàn tất. Kết quả và đơn thuốc (nếu có) sẽ xuất hiện trong tab Hồ sơ sức khỏe điện tử.",
  SKIPPED:
    "Phiếu khám đã bị bỏ qua do không có mặt khi được gọi. Vui lòng liên hệ quầy tiếp đón để được xếp lại lịch.",
  CANCELLED:
    "Phiếu khám đã bị hủy. Bạn có thể đặt một lịch hẹn mới bất cứ lúc nào.",
  PENDING_CONFIRMATION:
    "Chưa có phiếu khám kết thúc. Kết quả sẽ xuất hiện sau khi bác sĩ hoàn tất lượt khám.",
  REJECTED: "Vé online tạm thời đã bị từ chối xác thực.",
  WAITING: "",
  CALLED: "",
  IN_CONSULTATION: "",
};

/** The three khoa the clinic runs, keyed by `departments.id`. */
const DEPARTMENT_LABELS: Record<number, string> = {
  1: "Khoa Nội Tổng quát & Tim mạch",
  2: "Khoa Hô hấp & Dị ứng",
  3: "Khoa Da liễu",
};

const ENCOUNTER_STATUS_BADGES: Record<
  EncounterStatus,
  { label: string; className: string }
> = {
  COMPLETED: {
    label: "Đã hoàn tất",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  IN_PROGRESS: {
    label: "Đang khám",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

function departmentLabelOf(departmentId: number | undefined): string {
  if (departmentId === undefined) return "Chuyên khoa";
  return DEPARTMENT_LABELS[departmentId] ?? "Chuyên khoa";
}

/** `BS. Nguyễn Văn A`, without doubling a title the backend already wrote. */
function doctorLabelOf(doctorName: string | undefined): string {
  const trimmed = (doctorName ?? "").trim();
  if (!trimmed) return "Bác sĩ phụ trách";
  return /^(BS\.?|Bác sĩ|PGS|TS|ThS|CKI|CKII)\b/i.test(trimmed)
    ? trimmed
    : `BS. ${trimmed}`;
}

/** `yyyy-MM-dd` or an ISO datetime as the `dd/MM/yyyy` the card prints. */
function dateLabelFromEncounter(iso: string | null | undefined): string {
  if (!iso) return "--/--/----";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/** Fallback when the service has not attached a receipt amount to the ticket. */
const DEFAULT_CONSULTATION_FEE = 150_000;

function vnd(value: number | null | undefined): string {
  const amount =
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${amount.toLocaleString("vi-VN")} đ`;
}

function pharmacyBadge(
  status: PrescriptionStatus | null | undefined,
  hasItems: boolean,
): { label: string; className: string } {
  if (status === "DISPENSED") {
    return {
      label: "Đã nhận thuốc tại quầy Dược",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (status === "PENDING_DISPENSE" || status === "DISPENSING") {
    return {
      label: "Chờ nhận thuốc tại quầy Dược",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (status === "CANCELLED") {
    return {
      label: "Đơn thuốc đã hủy",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (hasItems) {
    return {
      label: "Đã kê đơn thuốc",
      className: "border-clinical-200 bg-clinical-50 text-clinical-700",
    };
  }
  return {
    label: "Không kê đơn thuốc",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<DashboardTab>(() =>
    searchParams.get("tab") === "ehr" ? "records" : "queue",
  );
  // Read once on mount: the route unmounts between visits, so a booking made on
  // /patient/booking is picked up the next time the dashboard is opened.
  // Only this account's own scoped cache is consulted, and it must pass an
  // ownership check (printed name or contact phone) before it is shown -
  // anything else is purged rather than rendered. The reader itself also sweeps
  // the legacy shared keys an earlier build wrote (`clinic_active_booking`).
  const [storedBooking] = useState(() =>
    readOwnedActiveBooking(
      user
        ? { email: user.email, fullName: user.fullName, phone: user.phone }
        : null,
    ),
  );
  // Set when this screen itself removes a hold (manual cancel or 00:00 expiry).
  // The hook purges localStorage, this hides the cached copy without waiting
  // for another render cycle from an effect.
  const [clearedTicketCode, setClearedTicketCode] = useState<string | null>(null);
  // The cancel flow: a confirmation step (an appointment is not thrown away on
  // one click) and a busy flag so the request cannot be fired twice.
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // Online payment: the modal, its busy flag, and the just-paid backend answer.
  // `paidDetail` bridges the gap until the next 3-second poll sees the receipt.
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paidDetail, setPaidDetail] = useState<QueueTicketDetailResponse | null>(null);
  // EHR tab: the live encounter timeline, its own loading/error state, and the
  // cards the patient has opened. `encounterReloadToken` re-runs the loader when
  // "Làm mới" is pressed or a visit transitions to COMPLETED.
  const [encounters, setEncounters] = useState<PatientEncounterDto[]>([]);
  const [isLoadingEncounters, setIsLoadingEncounters] = useState(true);
  const [encounterError, setEncounterError] = useState<string | null>(null);
  const [expandedEncounterKeys, setExpandedEncounterKeys] = useState<string[]>([]);
  const [encounterReloadToken, setEncounterReloadToken] = useState(0);
  // Identifiers for the intake service: the account's phone first (what a
  // check-in records), then the BHYT number, then the CCCD - each in the
  // spellings that can differ between AuthService and PatientIntakeService,
  // plus the phone recorded on a booking made for a relative. AuthService's
  // `users.id` must never be sent: it is a different database's primary key and
  // does not map onto PatientIntakeService's `Patient.id`. The list is memoized
  // because the polling hook keys its effect on it.
  const identifierList = useMemo(
    () => identifierCandidates(user, [storedBooking?.phone]),
    [user, storedBooking],
  );
  // A rejected ticket immediately starts the three-minute re-booking ban. The
  // queue service owns the lock; the local copy keeps the banner alive across
  // reloads and service outages.
  const bookingLock = useBookingLock({
    patientId: storedBooking?.patientId,
    identifiers: identifierList,
    ownerEmail: user?.email,
  });
  const { activateLock } = bookingLock;
  const handleTicketRejected = useCallback(
    (detail: QueueTicketDetailResponse) => {
      activateLock(detail.rejectionReason);
    },
    [activateLock],
  );
  // Live view of the ticket: the verified stored booking seeds the screen
  // immediately, and the hook overwrites it with the backend's answer (found by
  // intake patient id or by any of those identifiers, so a ticket booked on
  // another device - or before this browser saw the booking flow - still shows)
  // as soon as one lands.
  const ticket = usePatientTicket(
    storedBooking,
    identifierList,
    user?.email ?? null,
    handleTicketRejected,
  );
  const { refresh: refreshTicket } = ticket;
  // The just-paid answer stays on screen until the next poll reports the same
  // receipt. Once the poll sees it (or sees an admin decision), the backend is
  // authoritative again.
  const detail =
    ticket.detail?.status === "PENDING_CONFIRMATION" &&
    !ticket.detail.isReceiptVerified &&
    paidDetail?.ticketNumber === ticket.detail.ticketNumber
      ? paidDetail
      : ticket.detail;
  // A booking the backend rejects as unknown (400/404) is dropped by the hook;
  // from the page's point of view the patient simply has no appointment left.
  // The backend's own answer also counts as a real appointment, even when the
  // cache was lost - it was found by the signed-in patient's own identifier.
  const mirroredBooking = detail
    ? appointmentFromTicketDetail(detail)
    : storedBooking;
  const visibleBooking =
    mirroredBooking?.ticketCode === clearedTicketCode ? null : mirroredBooking;
  const ownedBooking = ticket.invalidTicket ? null : visibleBooking;
  // A day that has already passed is not an active appointment, whatever the
  // cache or a lagging poll may still say: that visit belongs in "Lịch sử đặt
  // lịch", never under the live queue board.
  const ownedBookingExpired =
    ownedBooking !== null && isStoredBookingExpired(ownedBooking);
  const detailExpired =
    detail !== null && isAppointmentDateExpired(detail.appointmentDate);
  const hasAppointment =
    !ownedBookingExpired && !detailExpired && ownedBooking !== null;

  // The stored booking renders on its own while the first poll is in flight;
  // once it answers, the backend's copy wins everywhere it has an opinion.
  const display = {
    ticketCode: detail?.ticketNumber ?? ownedBooking?.ticketCode ?? "",
    patientName: detail?.patientFullName ?? ownedBooking?.patientName ?? "",
    department: detail?.departmentName ?? ownedBooking?.department ?? "",
    doctor: detail?.doctorName ?? ownedBooking?.doctor ?? "",
    room: detail?.roomNumber ?? ownedBooking?.room ?? "",
    date: detail ? dateLabelFrom(detail.appointmentDate) : ownedBooking?.date ?? "",
    timeSlot: detail
      ? detail.slotStartTime.slice(0, 5)
      : ownedBooking?.timeSlot ?? "",
  };
  const statusBadge = STATUS_BADGES[ticket.status];
  const isTemporary = isTemporaryStatus(ticket.status);
  const isOfficial = isConfirmedTicket(ticket.status);
  const isPaid = detail?.isReceiptVerified ?? ownedBooking?.isReceiptVerified ?? false;
  const statusLabel =
    isTemporary && isPaid ? PAID_PENDING_LABEL : statusBadge.label;
  const consultationFee = detail?.receiptAmount ?? DEFAULT_CONSULTATION_FEE;
  const confirmedAt = detail?.confirmedAt ?? ownedBooking?.confirmedAt ?? null;
  const confirmedBy = detail?.confirmedBy ?? ownedBooking?.confirmedBy ?? null;
  const canCancel =
    detail?.canCancel ?? ownedBooking?.canCancel ?? !isOfficial;
  const checkInPayload = JSON.stringify({
    ticket: display.ticketCode,
    patient: display.patientName,
    room: display.room,
  });

  const activePatientId = detail?.patientId ?? ownedBooking?.patientId ?? null;
  const activeTicketNumber = detail?.ticketNumber ?? ownedBooking?.ticketCode ?? null;
  const activeTicketStatus = detail?.status ?? ownedBooking?.status ?? null;
  const storedPatientId = ownedBooking?.patientId ?? null;

  /**
   * Build the patient's visit timeline from both services.
   *
   * AuthService's `users.id` is not necessarily PatientIntakeService's
   * `Patient.id`, so the encounter lookup by patient id alone would come back
   * empty for a patient created during intake. The intake history is therefore
   * read first - by the active ticket's id, by every identifier spelling the
   * account carries, and by the cached booking - and the ticket numbers /
   * patient ids found there drive the clinical lookups. The two clinical
   * sources run in parallel and are merged on `encounterId` (falling back to
   * ticket number + date), newest first.
   */
  useEffect(() => {
    if (!user) return;
    const signedInUser = user;
    const controller = new AbortController();
    const { signal } = controller;
    let cancelled = false;

    async function loadEncounters() {
      setIsLoadingEncounters(true);
      setEncounterError(null);

      try {
        const { encounters: merged, answered } = await loadPatientEncounters(
          {
            userId: signedInUser.id,
            identifiers: identifierList,
            patientIds: [signedInUser.id, activePatientId, storedPatientId],
            ticketNumbers: [activeTicketNumber],
          },
          signal,
        );
        if (cancelled || signal.aborted) return;

        setEncounters(merged);
        setExpandedEncounterKeys((current) => {
          if (merged.length === 0) return [];
          // Keep the patient's own open/closed choices across a refresh, but
          // open the newest visit by default on the first successful load.
          return current.length > 0 ? current : [encounterKey(merged[0])];
        });
        if (merged.length === 0 && !answered) {
          setEncounterError(
            "Không tải được lịch sử thăm khám từ hệ thống. Vui lòng thử lại.",
          );
        }
      } catch (cause) {
        if (cancelled || signal.aborted) return;
        setEncounterError(
          cause instanceof Error
            ? cause.message
            : "Không tải được lịch sử thăm khám. Vui lòng thử lại.",
        );
        setEncounters([]);
        setExpandedEncounterKeys([]);
      } finally {
        if (!cancelled) setIsLoadingEncounters(false);
      }
    }

    void loadEncounters();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    user,
    identifierList,
    activePatientId,
    activeTicketNumber,
    activeTicketStatus,
    storedPatientId,
    encounterReloadToken,
  ]);

  const totalPatientPaid = useMemo(
    () =>
      encounters.reduce(
        (sum, encounter) =>
          sum +
          (typeof encounter.patientCopayAmount === "number"
            ? encounter.patientCopayAmount
            : 0),
        0,
      ),
    [encounters],
  );

  function handleRefreshEncounters() {
    setEncounterReloadToken((token) => token + 1);
    ticket.refresh();
  }

  function toggleEncounter(key: string) {
    setExpandedEncounterKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  /**
   * Cancel the active ticket and give its slot back.
   *
   * Order matters: the backend is asked first (a failure must not wipe the
   * patient's copy of the booking), then the localStorage cache is dropped -
   * otherwise this screen would keep rendering an appointment the clinic has
   * already released - and finally the hook is told to re-poll instead of
   * waiting out the 10-second interval. The success copy spells out that the
   * khung giờ is free again, because that is what the patient is waiting to
   * hear after cancelling.
   */
  async function handleCancelTicket() {
    const ticketNumber = display.ticketCode;
    // A confirmed ticket is final: no cancellation and no refund, whatever a
    // stale button or an old tab might still suggest.
    if (!isTemporary || !canCancel || !ticketNumber || isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelTicketApi(ticketNumber);
      clearActiveBooking(user?.email);
      setClearedTicketCode(ticketNumber);
      setConfirmingCancel(false);
      refreshTicket();
      toast.success(
        "Vé online tạm thời đã được hủy. Khung giờ khám đã được hoàn trả lại hệ thống.",
        { duration: 6000 },
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Không hủy được lịch hẹn. Vui lòng thử lại.",
        { duration: 6000 },
      );
    } finally {
      setIsCancelling(false);
    }
  }

  /**
   * Record the VietQR payment on the temporary ticket. The returned DTO is
   * mirrored to localStorage at once so a reload still shows "already paid",
   * then the normal 3-second poll takes over.
   */
  async function handlePaymentConfirm() {
    const ticketNumber = detail?.ticketNumber ?? ownedBooking?.ticketCode;
    if (!ticketNumber || isPaying) return;
    setIsPaying(true);
    setPaymentError(null);
    try {
      const updated = await payOnlineTicketApi(ticketNumber);
      syncActiveBooking(updated, user?.email);
      setPaidDetail(updated);
      setIsPaymentModalOpen(false);
      toast.success(PAYMENT_SUCCESS_TOAST, { duration: 6000 });
      refreshTicket();
    } catch (cause) {
      setPaymentError(
        cause instanceof Error
          ? cause.message
          : "Không ghi nhận được thanh toán. Vui lòng thử lại.",
      );
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-light text-slate-900">
      <PatientNavbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-clinical-600">
            Cổng Bệnh nhân
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Xin chào, {user?.fullName || "Quý khách"}
          </h1>
          <p className="text-base text-slate-500">
            Theo dõi lượt khám trực tiếp và truy cập hồ sơ sức khỏe điện tử của
            bạn.
          </p>
        </div>

        {bookingLock.isLocked && (
          <div className="mt-6 rounded-xl border border-rose-300 bg-rose-50 p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-rose-800">
                <Ban className="h-4 w-4 shrink-0" aria-hidden="true" />
                Tài khoản tạm khóa đặt lịch trong{" "}
                <span className="font-mono text-base font-bold tabular-nums text-rose-700">
                  {formatCountdown(bookingLock.remainingSeconds)}
                </span>{" "}
                do vé online trước đó bị từ chối.
              </p>
              {bookingLock.reason ? (
                <p className="text-xs text-rose-700">Lý do: {bookingLock.reason}</p>
              ) : null}
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div
          role="tablist"
          aria-label="Các mục của cổng bệnh nhân"
          className="mt-6 flex flex-wrap gap-2"
        >
          {(
            [
              { key: "queue", label: "Lịch hẹn & Xếp hàng trực tiếp" },
              { key: "records", label: "Hồ sơ sức khỏe điện tử (EHR)" },
            ] as { key: DashboardTab; label: string }[]
          ).map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.key)}
                className={`inline-flex h-12 items-center gap-2 rounded-full border px-5 text-base font-medium transition-colors ${
                  active
                    ? "border-clinical-600 bg-clinical-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-clinical-300 hover:text-clinical-700"
                }`}
              >
                {item.key === "queue" ? (
                  <Clock className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden="true" />
                )}
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "queue" ? (
          hasAppointment ? (
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {/* Active appointment */}
              <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Lịch hẹn đang hoạt động
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge.className}`}
                  >
                    <statusBadge.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {statusLabel}
                  </span>
                </div>
                {isTemporary && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {isPaid ? PAID_PENDING_LABEL : TEMPORARY_PENDING_LABEL}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          {isPaid
                            ? "Thanh toán đã được ghi nhận. Vé sẽ chuyển sang chính thức sau khi Admin duyệt."
                            : "Hoàn tất thanh toán online để Admin có thể xác thực vé của bạn."}
                        </p>
                      </div>
                      {!isPaid && (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentError(null);
                            setIsPaymentModalOpen(true);
                          }}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-clinical-600 px-5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-clinical-700"
                        >
                          <CreditCard className="h-4 w-4" aria-hidden="true" />
                          Thanh toán
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {isOfficial && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {OFFICIAL_TICKET_LABEL}
                      </span>
                      {isOfficial && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                          {OFFICIAL_TICKET_CONFIRMED}
                        </span>
                      )}
                    </div>
                    {confirmedAt && (
                      <p className="mt-2 text-xs font-semibold text-emerald-800">
                        Xác nhận lúc: {new Date(confirmedAt).toLocaleString("vi-VN")}
                        {confirmedBy ? ` · Bởi ${confirmedBy}` : ""}
                      </p>
                    )}
                    <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-emerald-800">
                      <ShieldAlert
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{NO_CANCEL_POLICY_NOTICE}</span>
                    </p>
                  </div>
                )}
                <dl className="mt-4 space-y-3 text-sm">
                  <Row label="Mã phiếu khám" value={display.ticketCode} bold />
                  <Row
                    label="Ngày & Giờ"
                    value={`${display.date}, ${display.timeSlot}`}
                  />
                  <Row label="Chuyên khoa" value={display.department} />
                  <Row label="Bác sĩ" value={display.doctor} />
                  <Row label="Phòng khám" value={display.room} />
                </dl>
                {ticket.isInQueue && (
                  <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-clinical-100 bg-clinical-50 p-3">
                    <div className="rounded-lg bg-white p-2 shadow-card">
                      <QRCodeSVG
                        value={checkInPayload}
                        size={104}
                        level="M"
                        fgColor="#0F172A"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <QrCode className="h-4 w-4 text-clinical-600" aria-hidden="true" />
                        Mã QR check-in
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        Xuất trình mã này tại kiosk cửa vào để lấy số thứ tự nhanh.
                      </p>
                    </div>
                  </div>
                )}
                {ticket.isOffline && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm leading-relaxed text-amber-800">
                      {ticket.error ||
                        "Không kết nối được dịch vụ hàng đợi. Đang hiển thị thông tin xác nhận lúc đặt lịch."}
                    </p>
                  </div>
                )}
                {/* Once confirmed the slot is final - no cancel, no refund. */}
                {isTemporary && canCancel && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="max-w-[15rem] text-xs leading-relaxed text-slate-500">
                      Không đến khám được? Hủy vé tạm thời để hoàn trả khung giờ
                      cho bệnh nhân khác.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmingCancel(true)}
                      disabled={isCancelling}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Ban className="h-4 w-4" aria-hidden="true" />
                      Hủy vé tạm thời
                    </button>
                  </div>
                )}
              </section>

              {ticket.isInQueue ? (
                /* Live queue tracker */
                <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Theo dõi hàng đợi trực tiếp
                    </p>
                    <span className="text-xs font-medium text-slate-400">
                      Cập nhật tự động mỗi 10 giây
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <QueueRow
                      label="Đang phục vụ"
                      value={ticket.currentServing ?? "Chưa có ai"}
                      active={ticket.currentServing !== null}
                      detail="Đang được tư vấn"
                    />
                    <QueueRow
                      label="Vé của bạn"
                      value={display.ticketCode}
                      highlight
                      detail={
                        ticket.yourTurn
                          ? "Đến lượt của bạn - vui lòng đến phòng khám"
                          : ticket.personsAhead !== null
                            ? `${ticket.personsAhead} người trước bạn`
                            : "Đang cập nhật thứ tự..."
                      }
                    />
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-clinical-600 text-white">
                        <Users className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="text-sm">
                        <p className="font-semibold text-slate-900">
                          {display.room}
                        </p>
                        <p className="text-slate-500">
                          {display.doctor} sẵn sàng tiếp đón bạn ngay sau đây.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                /* Finished, cancelled or skipped: no queue to track any more. */
                <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Phiếu khám đã kết thúc
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    {FINISHED_NOTICES[ticket.status]}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTab("records")}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-clinical-600 px-6 text-sm font-semibold text-white shadow-card transition-colors hover:bg-clinical-700"
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      Xem kết quả khám & chi phí
                    </button>
                    {bookingLock.isLocked ? (
                      <button
                        type="button"
                        disabled
                        title="Tài khoản đang trong thời gian tạm khóa"
                        className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-6 text-sm font-semibold text-slate-400"
                      >
                        Đặt lịch khám mới
                      </button>
                    ) : (
                      <Link
                        to="/patient/booking"
                        className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 transition-colors hover:border-clinical-400 hover:text-clinical-700"
                      >
                        Đặt lịch khám mới
                      </Link>
                    )}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <section className="mt-8 rounded-xl border border-slate-200/80 bg-white p-10 text-center shadow-card">
              <CalendarX size={32} className="mx-auto text-slate-300" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold text-slate-900">
                Bạn hiện không có lịch hẹn khám nào sắp tới
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                Các lịch khám trước đây đã hoàn tất hoặc hết hạn được lưu trong
                Lịch sử đặt lịch.
              </p>
              {bookingLock.isLocked ? (
                <button
                  type="button"
                  disabled
                  className="mt-6 inline-flex h-11 cursor-not-allowed items-center justify-center rounded-lg bg-slate-300 px-6 text-sm font-semibold text-slate-600"
                >
                  Đặt lịch khám ngay
                </button>
              ) : (
                <Link
                  to="/patient/booking"
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-clinical-600 px-6 text-sm font-semibold text-white shadow-card transition-colors hover:bg-clinical-700"
                >
                  Đặt lịch khám ngay
                </Link>
              )}
            </section>
          )
        ) : (
          <div className="mt-8 space-y-5">
            <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Hồ sơ sức khỏe điện tử (EHR)
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Lịch sử thăm khám, Chẩn đoán &amp; Chi phí
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    Kết quả khám, đơn thuốc và chi phí được đồng bộ trực tiếp
                    từ hệ thống bệnh án điện tử.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshEncounters}
                  disabled={isLoadingEncounters}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-clinical-400 hover:text-clinical-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoadingEncounters ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  Làm mới
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryStat
                  icon={Activity}
                  label="Tổng số lượt khám"
                  value={`${encounters.length} lượt`}
                />
                <SummaryStat
                  icon={Wallet}
                  label="Tổng tiền bệnh nhân đã thanh toán"
                  value={vnd(totalPatientPaid)}
                  accent
                />
              </div>
            </section>

            {isLoadingEncounters ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/80 bg-white py-16 shadow-card">
                <Loader2 className="h-7 w-7 animate-spin text-clinical-600" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-500">
                  Đang tải lịch sử thăm khám...
                </p>
              </div>
            ) : encounterError ? (
              <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-card">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold text-rose-800">
                    Không tải được lịch sử thăm khám
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-rose-700">
                    {encounterError}
                  </p>
                  <button
                    type="button"
                    onClick={handleRefreshEncounters}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Thử lại
                  </button>
                </div>
              </div>
            ) : encounters.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-card">
                <FileText className="h-9 w-9 text-slate-300" aria-hidden="true" />
                <p className="mt-4 text-base font-semibold text-slate-700">
                  Bạn chưa có lịch sử thăm khám nào.
                </p>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">
                  Kết quả chẩn đoán, đơn thuốc và chi phí sẽ xuất hiện tại đây
                  sau khi bác sĩ hoàn tất lượt khám của bạn.
                </p>
              </div>
            ) : (
              encounters.map((encounter) => {
                const key = encounterKey(encounter);
                return (
                  <EncounterCard
                    key={key}
                    encounter={encounter}
                    expanded={expandedEncounterKeys.includes(key)}
                    onToggle={() => toggleEncounter(key)}
                  />
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Cancellation confirmation: destructive actions always get a second step. */}
      {confirmingCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-booking-title"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isCancelling) {
              setConfirmingCancel(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200/80 bg-white p-5 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="cancel-booking-title"
                  className="text-base font-bold text-slate-900"
                >
                  Xác nhận hủy lịch hẹn
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {display.ticketCode} &middot; {display.date}, {display.timeSlot}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                disabled={isCancelling}
                aria-label="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Bạn chắc chắn muốn hủy lịch hẹn với{" "}
              <span className="font-semibold text-slate-900">{display.doctor}</span>{" "}
              không? Khung giờ khám sẽ được hoàn trả lại hệ thống và bạn có thể
              đặt lại bất cứ lúc nào.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                disabled={isCancelling}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Giữ lịch hẹn
              </button>
              <button
                type="button"
                onClick={() => void handleCancelTicket()}
                disabled={isCancelling}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Ban className="h-4 w-4" aria-hidden="true" />
                )}
                {isCancelling ? "Đang hủy..." : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isPaymentModalOpen && display.ticketCode ? (
        <PaymentConfirmationModal
          ticketNumber={display.ticketCode}
          amount={consultationFee}
          isProcessing={isPaying}
          error={paymentError}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setPaymentError(null);
          }}
          onConfirm={() => void handlePaymentConfirm()}
        />
      ) : null}

      <PatientFooter />
    </div>
  );
}

function vitalsOf(
  encounter: PatientEncounterDto,
): { label: string; value: string }[] {
  const vitals: { label: string; value: string }[] = [];
  const bloodPressure = encounter.bloodPressure?.trim();
  if (bloodPressure) {
    vitals.push({ label: "Huyết áp", value: `${bloodPressure} mmHg` });
  }
  if (typeof encounter.heartRate === "number" && Number.isFinite(encounter.heartRate)) {
    vitals.push({ label: "Mạch", value: `${encounter.heartRate} lần/phút` });
  }
  if (typeof encounter.spo2 === "number" && Number.isFinite(encounter.spo2)) {
    vitals.push({ label: "SpO2", value: `${encounter.spo2}%` });
  }
  const temperature = encounter.temperature?.trim();
  if (temperature) {
    vitals.push({ label: "Nhiệt độ", value: `${temperature} °C` });
  }
  return vitals;
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 ${
        accent ? "border-clinical-200 bg-clinical-50" : "border-slate-200 bg-slate-50/70"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          accent ? "bg-clinical-600 text-white" : "bg-white text-clinical-700 shadow-sm"
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p
          className={`truncate text-lg font-bold ${
            accent ? "text-clinical-700" : "text-slate-900"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof Activity;
  title: string;
}) {
  return (
    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
      <Icon className="h-4 w-4 text-clinical-600" aria-hidden="true" />
      {title}
    </h4>
  );
}

const SOAP_SECTIONS = [
  { key: "subjective", label: "Triệu chứng / Lý do khám" },
  { key: "objective", label: "Khám lâm sàng" },
  { key: "assessment", label: "Đánh giá của bác sĩ" },
  { key: "plan", label: "Lời dặn & Kế hoạch điều trị" },
] as const;

function EncounterCard({
  encounter,
  expanded,
  onToggle,
}: {
  encounter: PatientEncounterDto;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status =
    ENCOUNTER_STATUS_BADGES[encounter.status] ?? {
      label: encounter.status,
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  const diagnoses = encounter.diagnoses ?? [];
  const items = encounter.prescriptionItems ?? [];
  const pharmacy = pharmacyBadge(encounter.prescriptionStatus, items.length > 0);
  const vitals = vitalsOf(encounter);
  const showFinance =
    typeof encounter.totalAmount === "number" ||
    typeof encounter.insurancePaidAmount === "number" ||
    typeof encounter.patientCopayAmount === "number" ||
    items.length > 0;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-slate-900">
              Khám ngày {dateLabelFromEncounter(encounter.encounterDate)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600">
              Mã phiếu: {encounter.ticketNumber}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}
            >
              {status.label}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Stethoscope className="h-4 w-4 text-clinical-600" aria-hidden="true" />
              <span className="font-medium text-slate-500">Chuyên khoa:</span>
              {departmentLabelOf(encounter.departmentId)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-clinical-600" aria-hidden="true" />
              <span className="font-medium text-slate-500">Bác sĩ khám:</span>
              {doctorLabelOf(encounter.doctorName)}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-slate-100 px-5 py-5">
          {/* Diagnoses */}
          <div>
            <SectionTitle icon={Stethoscope} title="Chẩn đoán bệnh (ICD-10)" />
            {diagnoses.length > 0 ? (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {diagnoses.map((diagnosis) => (
                  <li
                    key={`${diagnosis.icd10Code}-${diagnosis.diseaseName}`}
                    className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      diagnosis.isPrimary
                        ? "border-clinical-300 bg-clinical-50"
                        : "border-slate-200 bg-slate-50/70"
                    }`}
                  >
                    <span className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-bold text-clinical-700 ring-1 ring-clinical-200">
                      {diagnosis.icd10Code}
                    </span>
                    <span className="font-medium text-slate-800">
                      {diagnosis.diseaseName}
                    </span>
                    {diagnosis.isPrimary && (
                      <span className="ml-auto rounded-full bg-clinical-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Chính
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-500">
                Bác sĩ chưa ghi nhận chẩn đoán ICD-10 cho lượt khám này.
              </p>
            )}
          </div>

          {/* Vitals + SOAP */}
          <div>
            <SectionTitle icon={HeartPulse} title="Chỉ số sinh hiệu & Kết quả khám (SOAP)" />
            {vitals.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {vitals.map((vital) => (
                  <span
                    key={vital.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-clinical-200 bg-clinical-50 px-3 py-1 text-xs font-medium text-clinical-800"
                  >
                    <span className="text-clinical-600">{vital.label}:</span>
                    <span className="font-bold">{vital.value}</span>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {SOAP_SECTIONS.map((section) => {
                const value = (encounter[section.key] ?? "").trim();
                return (
                  <div
                    key={section.key}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {section.label}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                      {value || "Không có ghi nhận."}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prescription */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle icon={Pill} title="Đơn thuốc & Trạng thái cấp phát" />
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${pharmacy.className}`}
              >
                <Pill className="h-3.5 w-3.5" aria-hidden="true" />
                {pharmacy.label}
              </span>
            </div>
            {items.length > 0 ? (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Tên thuốc + hàm lượng</th>
                      <th className="px-3 py-2">Cách dùng / Liều lượng</th>
                      <th className="px-3 py-2">Thời gian</th>
                      <th className="px-3 py-2 text-right">Số lượng</th>
                      <th className="px-3 py-2 text-right">Đơn giá</th>
                      <th className="px-3 py-2 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr
                        key={`${item.itemId ?? item.drugId ?? item.drugCode ?? item.drugName}-${index}`}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-900">
                            {item.drugName}
                            {item.concentration ? ` ${item.concentration}` : ""}
                          </p>
                          {item.dosageForm && (
                            <p className="text-xs text-slate-500">{item.dosageForm}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {item.routeFrequency?.trim() || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {item.duration?.trim() || "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {item.quantity.toLocaleString("vi-VN")}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {vnd(item.unitPrice)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">
                          {vnd(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-500">
                {encounter.prescriptionStatus === "CANCELLED"
                  ? "Đơn thuốc của lượt khám này đã bị hủy."
                  : "Bác sĩ không kê đơn thuốc cho lượt khám này."}
              </p>
            )}
          </div>

          {/* Billing */}
          {showFinance && (
            <div className="rounded-xl border border-clinical-200 bg-clinical-50/70 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-clinical-700 shadow-sm">
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-bold text-slate-900">
                  Chi tiết thanh toán / Chi phí (VNĐ)
                </p>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-600">Tổng chi phí đơn thuốc</dt>
                  <dd className="font-semibold text-slate-900">
                    {vnd(encounter.totalAmount)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-600">BHYT chi trả</dt>
                  <dd className="font-semibold text-emerald-600">
                    -{vnd(encounter.insurancePaidAmount)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-clinical-200 pt-2">
                  <dt className="font-semibold text-slate-900">
                    Bệnh nhân thực trả
                  </dt>
                  <dd className="text-lg font-bold text-clinical-700">
                    {vnd(encounter.patientCopayAmount)}
                  </dd>
                </div>
              </dl>
              {encounter.dispensedAt && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  Đã cấp phát thuốc lúc {dateLabelFromEncounter(encounter.dispensedAt)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={bold ? "font-bold text-slate-900" : "font-medium text-slate-900"}>
        {value}
      </dd>
    </div>
  );
}

function QueueRow({
  label,
  value,
  active = false,
  highlight = false,
  detail,
}: {
  label: string;
  value: string;
  active?: boolean;
  highlight?: boolean;
  detail: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
        active
          ? "border-teal-200 bg-teal-50"
          : highlight
            ? "border-clinical-200 bg-clinical-50"
            : "border-slate-200 bg-slate-50"
      }`}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p
          className={`text-base font-bold ${active ? "text-teal-700" : highlight ? "text-clinical-700" : "text-slate-900"}`}
        >
          {value}
        </p>
      </div>
      <p
        className={`text-right text-xs font-medium ${
          active ? "text-teal-800" : "text-slate-500"
        }`}
      >
        {detail}
        {active && (
          <span
            className="ml-1 inline-block h-2 w-2 rounded-full bg-teal-500"
            aria-hidden="true"
          />
        )}
      </p>
    </div>
  );
}
