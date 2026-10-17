import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CornerDownLeft, Loader2, TicketCheck } from "lucide-react";
import ReceptionHeader from "./components/ReceptionHeader";
import CardScannerBar from "./components/CardScannerBar";
import PatientIdentityForm from "./components/PatientIdentityForm";
import type { DuplicateBookingNotice } from "./components/PatientIdentityForm";
import SlotSelector from "./components/SlotSelector";
import TriageSelector from "./components/TriageSelector";
import QueueMonitorPanel from "./components/QueueMonitorPanel";
import TicketPrintModal from "./components/TicketPrintModal";
import { ticketViewFromIntake, ticketViewFromQueue } from "./ticketView";
import type { TicketView } from "./ticketView";
import { useIntakeForm } from "./hooks/useIntakeForm";
import type { IntakeErrors, IntakeField } from "./hooks/useIntakeForm";
import { useAvailableSlots } from "./hooks/useAvailableSlots";
import { useReceptionQueue } from "./hooks/useReceptionQueue";
import { checkInPatient, isDuplicateBookingError } from "../../services/intakeApi";
import type { QueueStatus, QueueTicket } from "../../services/intakeApi";
import { toIsoDate } from "../../services/ocrApi";
import type { BhytOcrData } from "../../services/ocrApi";
import type { OcrCardSample } from "./data/receptionMockData";

/** Maps a form field to the DOM node we focus/scroll to on a failed submit. */
const FIELD_ANCHORS: Record<IntakeField, string> = {
  fullName: "intake-fullName",
  identityCardNumber: "intake-identityCardNumber",
  insuranceCode: "intake-insuranceCode",
  initialHospitalCode: "intake-initialHospitalCode",
  dateOfBirth: "intake-dateOfBirth",
  gender: "intake-gender",
  phone: "intake-phone",
  address: "intake-address",
  departmentId: "intake-department",
  appointmentDate: "intake-appointmentDate",
  slotStartTime: "intake-slots",
  priorityLevel: "intake-triage",
  chiefComplaint: "intake-chiefComplaint",
};

const FIELD_LABELS: Record<IntakeField, string> = {
  fullName: "Họ tên",
  identityCardNumber: "Số CCCD",
  insuranceCode: "Mã thẻ BHYT",
  initialHospitalCode: "Nơi KCB ban đầu",
  dateOfBirth: "Ngày sinh",
  gender: "Giới tính",
  phone: "Số điện thoại",
  address: "Địa chỉ",
  departmentId: "Chuyên khoa",
  appointmentDate: "Ngày khám",
  slotStartTime: "Khung giờ",
  priorityLevel: "Mức độ ưu tiên",
  chiefComplaint: "Lý do vào viện",
};

const FIELD_ORDER = Object.keys(FIELD_ANCHORS) as IntakeField[];

/** Statuses that still hold a slot - the ones that block a second ticket. */
const ACTIVE_STATUSES: QueueStatus[] = ["WAITING", "CALLED", "IN_CONSULTATION"];

/**
 * Find the ticket the check-in conflict is about: same patient (phone first,
 * which is what check-in records, then the printed name) on the same day, still
 * in the queue. `null` when the desk cannot see it (different department's
 * queue, or already handed off) - the warning then names the day only.
 */
function findActiveDuplicate(
  tickets: QueueTicket[],
  date: string,
  phone: string,
  fullName: string,
): QueueTicket | undefined {
  const digits = phone.replace(/\D/g, "");
  const name = fullName.trim().toLowerCase();
  return tickets.find(
    (ticket) =>
      ticket.appointmentDate === date &&
      ACTIVE_STATUSES.includes(ticket.status) &&
      ((digits.length >= 8 &&
        (ticket.patient?.phone ?? "").replace(/\D/g, "").endsWith(digits)) ||
        (name.length > 0 && (ticket.patient?.fullName ?? "").trim().toLowerCase() === name)),
  );
}

function focusField(field: IntakeField) {
  const element = document.getElementById(FIELD_ANCHORS[field]);
  if (!element) return;
  // FIELD_ANCHORS may point at the control itself or at a wrapper around it.
  const focusable = element.matches("input, select, textarea, button")
    ? element
    : element.querySelector<HTMLElement>("input, select, textarea, button");
  const target = focusable ?? element;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  if (target !== element) target.focus({ preventScroll: true });
  else if (target instanceof HTMLElement) target.focus({ preventScroll: true });
}

export default function ReceptionDeskPage() {
  const intake = useIntakeForm();
  const { form } = intake;
  const slots = useAvailableSlots(form.departmentId, form.appointmentDate);
  const queue = useReceptionQueue(form.appointmentDate);

  const [errors, setErrors] = useState<IntakeErrors>({});
  const [touched, setTouched] = useState<Partial<Record<IntakeField, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printedTicket, setPrintedTicket] = useState<TicketView | null>(null);
  const [printedFromQueue, setPrintedFromQueue] = useState(false);
  const [lastScanned, setLastScanned] = useState<OcrCardSample | null>(null);
  /** Set when check-in was refused because this patient already has a ticket. */
  const [duplicateNotice, setDuplicateNotice] =
    useState<DuplicateBookingNotice | null>(null);

  /** Errors are only revealed for fields the secretary has actually touched. */
  const visibleErrors: IntakeErrors = Object.fromEntries(
    Object.entries(errors).filter(([field]) => touched[field as IntakeField]),
  );

  function handleFieldBlur(field: IntakeField) {
    setTouched((current) => ({ ...current, [field]: true }));
    const all = intake.validate();
    setErrors((current) => ({ ...current, [field]: all[field] }));
  }

  const handleSubmit = useCallback(async () => {
    const validation = intake.validate();
    setErrors(validation);
    setTouched(
      Object.fromEntries(FIELD_ORDER.map((field) => [field, true])) as Record<
        IntakeField,
        boolean
      >,
    );

    const firstInvalid = FIELD_ORDER.find((field) => validation[field]);
    if (firstInvalid) {
      toast.error(
        `Vui lòng kiểm tra "${FIELD_LABELS[firstInvalid]}" trước khi cấp số.`,
        { duration: 4000 },
      );
      focusField(firstInvalid);
      return;
    }

    // The slot grid can change under the secretary between selection and submit.
    if (!intake.isSlotConsistent(slots.slots)) {
      const message = "Khung giờ đã chọn không còn khả dụng. Vui lòng chọn lại.";
      setErrors((current) => ({ ...current, slotStartTime: message }));
      toast.error(message, { duration: 5000 });
      focusField("slotStartTime");
      return;
    }

    setIsSubmitting(true);
    setDuplicateNotice(null);
    try {
      const response = await checkInPatient(intake.toRequest());
      setPrintedTicket(ticketViewFromIntake(response, queue.tickets));
      setPrintedFromQueue(false);
      toast.success(
        `Đã cấp số ${response.ticketNumber} cho ${response.patientName} - ${response.roomNumber}.`,
        { duration: 6000 },
      );
      slots.refresh();
      queue.refresh();
    } catch (cause) {
      if (isDuplicateBookingError(cause)) {
        // The patient already holds an active ticket for this day. The form
        // keeps every value the secretary typed - the fix is to deal with the
        // ticket on file, not to retype this one - so the identity card grows
        // a banner naming it instead of a generic conflict toast.
        const existing = findActiveDuplicate(
          queue.tickets,
          form.appointmentDate,
          form.phone,
          form.fullName,
        );
        setDuplicateNotice({
          date: form.appointmentDate,
          existingTicketNumber: existing?.ticketNumber,
          existingSlot: existing?.slotStartTime,
        });
        toast.warning(
          cause instanceof Error
            ? cause.message
            : "Bệnh nhân đã có phiếu khám đang chờ trong ngày này.",
          { duration: 8000 },
        );
      } else {
        toast.error(
          cause instanceof Error
            ? cause.message
            : "Không thể tiếp nhận bệnh nhân. Vui lòng thử lại.",
          { duration: 7000 },
        );
      }
    } finally {
      setIsSubmitting(false);
    }
    // The duplicate lookup reads three of the form's own fields, so they are
    // listed below alongside the controllers that own the rest of the state.
  }, [intake, queue, slots, form.appointmentDate, form.fullName, form.phone]);

  /**
   * Queue transition from the monitor. Cancellation gets two extra steps: the
   * freed seat has to show up in the slot grid straight away (the backend
   * releases it on CANCELLED), and the secretary needs confirmation that the
   * khung giờ went back to the system.
   */
  const handleChangeStatus = useCallback(
    async (ticketNumber: string, status: QueueStatus) => {
      const applied = await queue.changeStatus(ticketNumber, status);
      if (!applied || status !== "CANCELLED") return;
      slots.refresh();
      toast.success(
        `Đã hủy phiếu ${ticketNumber}. Khung giờ khám đã được hoàn trả lại hệ thống.`,
        { duration: 4500 },
      );
    },
    [queue, slots],
  );

  // Enter anywhere except a textarea or a button dispatches the ticket.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
      event.preventDefault();
      void handleSubmit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSubmit]);

  function handleNextPatient() {
    // Keep the department and day; the next arrival usually belongs there.
    const departmentId = form.departmentId;
    const appointmentDate = form.appointmentDate;
    intake.reset();
    intake.updateField("departmentId", departmentId);
    intake.updateField("appointmentDate", appointmentDate);
    setErrors({});
    setTouched({});
    setLastScanned(null);
    setPrintedTicket(null);
  }

  function handleReprint(ticket: QueueTicket) {
    setPrintedTicket(ticketViewFromQueue(ticket, queue.tickets));
    setPrintedFromQueue(true);
  }

  /**
   * Fold a real AI Gateway OCR payload into the form and keep a display-only
   * sample for the scanner bar's verified banner. A BHYT card carries no CCCD
   * number or phone, so those hand-typed fields stay untouched.
   */
  function handleApplyOcr(data: BhytOcrData) {
    intake.applyOcrResult(data);
    const hospitalFull =
      (data.noi_kcb_ban_dau_full ?? "").trim() ||
      (data.ma_noi_dkkcb_ban_dau ?? "").trim();
    setLastScanned({
      id: "bhyt-ai-ocr",
      cardLabel: "Thẻ BHYT (AI OCR)",
      confidence: 100,
      fullName: (data.ho_ten ?? data.fullName ?? "").trim(),
      identityCardNumber: "",
      insuranceCode: (data.ma_so_bhyt_formatted ?? data.ma_so_bhyt ?? "").trim(),
      initialHospitalCode: hospitalFull,
      dateOfBirth: toIsoDate(data.ngay_sinh_iso) || toIsoDate(data.ngay_sinh),
      gender: (data.gioi_tinh ?? data.gender ?? "").trim(),
      phone: "",
      address: (data.dia_chi ?? "").trim(),
    });
    toast.success("Đã bóc tách thông tin thẻ BHYT và áp dụng vào form tiếp nhận.");
  }

  const isBlocked = isSubmitting || queue.isMutating;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-light text-slate-900">
      <ReceptionHeader
        waitingCount={queue.waitingCount}
        emergencyCount={queue.emergencyCount}
        isOffline={queue.isOffline || slots.isOffline}
      />

      <div className="flex min-h-0 flex-1">
        {/* Left: intake & administrative entry (60%) */}
        <main className="flex w-[60%] min-w-0 flex-col overflow-hidden border-r border-slate-200/80">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <CardScannerBar
              mode={form.mode}
              isOcrVerified={form.isOcrVerified}
              sample={lastScanned}
              onModeChange={intake.setMode}
              onApplyOcr={handleApplyOcr}
            />

            <PatientIdentityForm
              form={form}
              errors={visibleErrors}
              notice={duplicateNotice}
              onDismissNotice={() => setDuplicateNotice(null)}
              onChange={intake.updateField}
              onFieldBlur={handleFieldBlur}
            />

            <SlotSelector
              form={form}
              errors={visibleErrors}
              slots={slots.slots}
              isLoading={slots.isLoading}
              isOffline={slots.isOffline}
              loadError={slots.error}
              onChange={intake.updateField}
              onRefresh={slots.refresh}
              onSlotSelected={() =>
                // A previous "slot no longer available" error must not linger
                // after the secretary picks a different slot.
                setErrors((current) =>
                  current.slotStartTime
                    ? { ...current, slotStartTime: undefined }
                    : current,
                )
              }
            />

            <TriageSelector
              form={form}
              errors={visibleErrors}
              onChange={intake.updateField}
            />
          </div>

          {/* Submit dock */}
          <footer className="shrink-0 border-t border-slate-200/80 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="hidden min-w-0 flex-1 lg:block">
                <p className="truncate text-xs font-semibold text-slate-700">
                  {form.fullName.trim() || "Chưa nhập tên bệnh nhân"}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {form.slotStartTime
                    ? `Khung giờ ${form.slotStartTime.slice(0, 5)} - ${form.appointmentDate}`
                    : "Chưa chọn khung giờ"}
                </p>
              </div>
              <span className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 xl:inline-flex">
                <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Nhấn Enter để cấp số
              </span>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isBlocked}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 lg:flex-none lg:px-8"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <TicketCheck className="h-5 w-5" aria-hidden="true" />
                )}
                {isSubmitting
                  ? "Đang cấp số..."
                  : "Cấp Số Thứ Tự & Phân Buồng Khám"}
              </button>
            </div>
          </footer>
        </main>

        {/* Right: live clinic queue monitor (40%) */}
        <aside className="flex w-[40%] min-w-0 flex-col">
          <QueueMonitorPanel
            tickets={queue.tickets}
            date={form.appointmentDate}
            waitingCount={queue.waitingCount}
            emergencyCount={queue.emergencyCount}
            isLoading={queue.isLoading}
            isMutating={queue.isMutating}
            isOffline={queue.isOffline}
            error={queue.error}
            lastUpdatedAt={queue.lastUpdatedAt}
            onRefresh={queue.refresh}
            onChangeStatus={(ticketNumber, status) =>
              void handleChangeStatus(ticketNumber, status)
            }
            onPrint={handleReprint}
          />
        </aside>
      </div>

      {printedTicket && (
        <TicketPrintModal
          ticket={printedTicket}
          onClose={() => setPrintedTicket(null)}
          onNextPatient={printedFromQueue ? () => setPrintedTicket(null) : handleNextPatient}
          nextLabel={printedFromQueue ? "Đóng" : "Bệnh nhân tiếp theo"}
        />
      )}
    </div>
  );
}
