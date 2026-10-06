import { useCallback, useState, type FormEvent } from "react";
import { Calendar, ChevronLeft, Check, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/useAuth";
import { updateMyProfileApi } from "../../services/authApi";
import type { UpdatePatientRequestDto } from "../../services/authApi";
import PatientNavbar from "./components/PatientNavbar";
import PatientFooter from "./components/PatientFooter";
import SymptomsStep from "./components/SymptomsStep";
import BookingIdentityFields from "./components/BookingIdentityFields";
import BookingTicketModal from "./components/BookingTicketModal";
import FloatingRagChatbot from "./components/FloatingRagChatbot";
import {
  CLINIC_SERVICES,
  resolveDoctorForService,
  serviceIndexForDepartment,
} from "./data/clinicContent";
import { triageSymptoms } from "./data/patientMockRecords";
import { hospitalCodeFrom } from "./data/patientProfile";
import { writeActiveBooking } from "./data/activeBooking";
import {
  sendVoiceScheduleTriage,
  sessionScheduleFor,
  VoiceTriageError,
} from "../../services/voiceTriageApi";
import type { BookingIdentityFieldsValue } from "./components/BookingIdentityFields";
import type { Service } from "./data/clinicContent";
import type { User } from "../../types/auth";
import type {
  SessionName,
  VoiceScheduleTriageResponse,
} from "../../services/voiceTriageApi";
import type { ActiveAppointment, BhyTelemetry } from "./data/patientMockRecords";

/**
 * Push a card just read in the booking flow onto the patient's own profile, so
 * the next visit - here or on /patient/profile - can reuse it instead of asking
 * for the same photo again.
 *
 * Every field falls back to what the session already holds rather than to a blank:
 * a card that reads half its data must not erase the other half of someone's
 * profile, and `PUT /auth/me/profile` overwrites whatever it receives.
 *
 * Best effort by design. The scan has already been shown to the patient, so a
 * backend hiccup here is worth a console warning, not an error toast in the
 * middle of a booking - the appointment itself does not depend on it.
 *
 * Returns the session patch that was applied, or `null` if nothing was.
 */
async function syncScannedCardToProfile(
  info: BhyTelemetry,
  clinicCode: string,
  user: User | null,
  updateUser: (patch: Partial<User>) => void,
): Promise<void> {
  if (!user) return;

  // The card prints no phone number and none of these is typed here, so they
  // carry over from the session rather than being cleared.
  const patch: Partial<User> = {
    fullName: info.fullName?.trim() || user.fullName,
    phone: user.phone,
    identityCardNumber: user.identityCardNumber,
    insuranceCode: info.insuranceCode?.trim() || user.insuranceCode,
    initialHospitalCode: clinicCode || user.initialHospitalCode,
    dateOfBirth: info.dateOfBirth || user.dateOfBirth,
    gender: info.gender?.trim() || user.gender,
    address: info.address?.trim() || user.address,
    isOcrVerified: true,
  };
  // Sending `undefined` for these would clear a column the backend does hold, so
  // only include what the scan actually resolved.
  const payload: UpdatePatientRequestDto = {
    fullName: patch.fullName ?? user.fullName,
    phone: patch.phone || null,
    identityCardNumber: patch.identityCardNumber || null,
    insuranceCode: patch.insuranceCode || null,
    initialHospitalCode: patch.initialHospitalCode || null,
    dateOfBirth: patch.dateOfBirth || null,
    gender: patch.gender || null,
    address: patch.address || null,
    isOcrVerified: true,
  };

  try {
    // No token argument: the bearer interceptor on `authApi` stamps the current
    // session onto every request.
    const saved = await updateMyProfileApi(payload);
    // Prefer what the backend echoed back over what we sent, so a value it
    // normalised or trimmed lands in the session rather than our guess of it.
    updateUser({
      ...patch,
      insuranceCode: saved.insuranceCode ?? patch.insuranceCode,
      initialHospitalCode: saved.initialHospitalCode ?? patch.initialHospitalCode,
      dateOfBirth: saved.dateOfBirth ?? patch.dateOfBirth,
      gender: saved.gender ?? patch.gender,
      address: saved.address ?? patch.address,
      isOcrVerified: saved.isOcrVerified ?? true,
    });
  } catch (error) {
    console.warn("Booking: could not sync the scanned card to the profile.", error);
  }
}

const TIME_SLOTS = [
  "08:30",
  "09:30",
  "10:30",
  "11:30",
  "14:00",
  "15:30",
  "16:30",
  "17:30",
];

const STEP_LABELS = ["Triệu chứng", "Chuyên khoa", "Xác nhận"];

/**
 * Booking times that fall inside each half of the clinic day, as the schedule
 * service defines them (`07:30 - 11:30` / `13:00 - 17:00`).
 *
 * Used to turn a session picked in the dispatcher into an actual slot: the two
 * lists do not overlap, so the first entry is always a valid choice rather than a
 * guess at which of these eight is "morning".
 */
const SESSION_TIME_SLOTS: Record<SessionName, string[]> = {
  MORNING: ["08:30", "09:30", "10:30", "11:30"],
  AFTERNOON: ["14:00", "15:30", "16:30", "17:30"],
};

/** Today in the local offset, as the `target_date` query param wants it. */
function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** `YYYY-MM-DD` as the `dd/MM/yyyy` the ticket prints. */
function dateLabelFrom(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** The booking form, patient identity included. */
interface BookingFormData extends BookingIdentityFieldsValue {
  /** True once a card has been read back through the OCR service. */
  isOcrVerified: boolean;
}

const EMPTY_FORM: BookingFormData = {
  fullName: "",
  phone: "",
  insuranceCode: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  initialHospitalCode: "",
  isOcrVerified: false,
};

/**
 * A fresh booking form, seeded from the signed-in account.
 *
 * A returning patient has already had their card read - by this flow once, or by
 * /patient/profile before it - so re-asking for the same photo on every booking
 * is busywork. Their card number is the signal that there is something to reuse;
 * without one, the form starts empty and step 1 asks for a scan as before.
 */
function formFromSession(user: User | null): BookingFormData {
  return {
    ...EMPTY_FORM,
    fullName: user?.fullName ?? "",
    phone: user?.phone?.trim() ?? "",
    insuranceCode: user?.insuranceCode ?? "",
    dateOfBirth: user?.dateOfBirth ?? "",
    gender: user?.gender ?? "",
    address: user?.address ?? "",
    initialHospitalCode: user?.initialHospitalCode ?? "",
    isOcrVerified: user?.isOcrVerified === true,
  };
}

export default function BookingPage() {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [symptoms, setSymptoms] = useState("");
  const [deptIdx, setDeptIdx] = useState<number | null>(null);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [formData, setFormData] = useState<BookingFormData>(() =>
    formFromSession(user),
  );
  const [ticket, setTicket] = useState<ActiveAppointment | null>(null);
  /**
   * Set when a patient with a card on file asks to replace it.
   *
   * Not "has scanned": until they ask, the card in the session stands in for a
   * scan, so this gates the scanner rather than recording its result.
   */
  const [rescanRequested, setRescanRequested] = useState(false);
  /** Set once a scan lands here, so this page stops re-offering to skip it. */
  const [scannedThisSession, setScannedThisSession] = useState(false);

  // --- Voice triage state -----------------------------------------------------
  // Held here rather than inside SymptomsStep because the results outlive the
  // step: picking a shift advances to the confirmation screen, and the dispatcher
  // has to be there to answer "why this doctor?" if the patient steps back.
  const [voiceTriage, setVoiceTriage] =
    useState<VoiceScheduleTriageResponse | null>(null);
  /**
   * The recorded clip.
   *
   * Kept because re-querying another date means re-uploading: the gateway
   * transcribes on every call and caches nothing, so "what about tomorrow?" has to
   * send the audio again rather than re-use a stored transcription.
   */
  const [voiceClip, setVoiceClip] = useState<Blob | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isRefreshingSchedule, setIsRefreshingSchedule] = useState(false);
  const [scheduleUnavailable, setScheduleUnavailable] = useState(false);
  const [triageDate, setTriageDate] = useState(todayIso);
  const [shiftSelection, setShiftSelection] = useState<{
    session: SessionName;
    doctorId: number | null;
  } | null>(null);
  /**
   * The gateway's `department_id` for the current verdict (1/2/3), kept apart from
   * `deptIdx`.
   *
   * They are different things: this is a stable backend category, `deptIdx` is a
   * position in `CLINIC_SERVICES`. Holding both keeps "which category did the
   * model choose?" answerable without reading it back out of the response object,
   * and keeps the index free to be re-derived if the service list ever changes.
   */
  const [selectedDepartmentId, setSelectedDepartmentId] =
    useState<number | null>(null);
  /**
   * The transcription the current verdict was derived from.
   *
   * A verdict is only true of the words it read. Once the patient edits those
   * words the department, priority and rota no longer describe what is on
   * screen, so the comparison against this string is what invalidates them.
   * Empty when the gateway returned no transcription (the schedule-down path), in
   * which case there is nothing to compare and the verdict simply stands.
   */
  const [triageSourceText, setTriageSourceText] = useState("");

  /**
   * Adopt the session's card the first time it shows up.
   *
   * `AuthProvider` revalidates on mount and that `/me` response arrives after
   * the first paint, so a card saved on /patient/profile lands here slightly
   * late - the `useState` initializer alone would miss it.
   *
   * Adjusted during render rather than in an effect (a setState-in-effect is a
   * lint error in this repo, and would cascade a second render): this form is
   * catching up with its own source, not an external system. Guarded on the card
   * number having actually changed, so a scan performed on this page is never
   * overwritten by the older session copy it just replaced.
   */
  const sessionInsuranceCode = user?.insuranceCode ?? "";
  const [seededFrom, setSeededFrom] = useState(sessionInsuranceCode);
  if (seededFrom !== sessionInsuranceCode && !scannedThisSession) {
    setSeededFrom(sessionInsuranceCode);
    setFormData((prev) => ({ ...prev, ...formFromSession(user) }));
  }

  /**
   * Whether step 1 can skip the scanner.
   *
   * Needs a card number on file *and* the patient not having asked for a rescan.
   * A patient who typed the number in by hand has no photo to reuse, so they are
   * asked for one as before.
   */
  const savedCardCode = user?.insuranceCode?.trim() ?? "";
  const canSkipScan = savedCardCode.length > 0 && !rescanRequested;

  /**
   * Which department the "Đề xuất" chip marks on step 2.
   *
   * The voice verdict wins over keyword matching whenever both exist: it was
   * produced by a clinical model reading an actual transcript, whereas the
   * keyword matcher only sees the words and matches substrings.
   */
  const keywordSuggestion = triageSymptoms(symptoms);
  const suggestedIdx = voiceTriage
    ? serviceIndexForDepartment(
        selectedDepartmentId ?? voiceTriage.department_id,
      )
    : keywordSuggestion
      ? CLINIC_SERVICES.findIndex((s) => s.title === keywordSuggestion.department)
      : null;

  /** Type-safe single-field write, so the identity inputs and the scan share one setter. */
  function setFormField<K extends keyof BookingFormData>(
    field: K,
    next: BookingFormData[K],
  ) {
    setFormData((prev) => ({ ...prev, [field]: next }));
  }

  /**
   * Bind a scanned card into the booking form.
   *
   * Every extracted field falls back to the value already in the form, so a
   * rescan never wipes something the patient typed or corrected by hand - an
   * unreadable field simply leaves the previous value standing.
   *
   * `phone` is not in that list at all: it is not a form field, it is bound from
   * the session, so the spread carries it through untouched. A BHYT card carries
   * no phone number, and the only number a "Xem ảnh thẻ mẫu" scan could supply
   * is the fictional demo one (`0900 000 000`) - which must never become the
   * number the appointment is confirmed against.
   */
  const handleOcrExtracted = useCallback(
    (info: BhyTelemetry) => {
      // The clinic arrives as `"79-014 (BV Đa Khoa Sài Gòn)"`. The profile page
      // picks it from a `<select>` of bare codes, so store the bare code -
      // otherwise a synced value matches no option and renders blank.
      const clinic =
        hospitalCodeFrom(info.initialHospitalCode) ||
        hospitalCodeFrom(info.hospital ?? "");

      setFormData((prev) => ({
        ...prev,
        fullName: info.fullName?.trim() || prev.fullName,
        insuranceCode: info.insuranceCode?.trim() || prev.insuranceCode,
        // `ngay_sinh_iso` is already `YYYY-MM-DD`, which is what the date input needs.
        dateOfBirth: info.dateOfBirth || prev.dateOfBirth,
        gender: info.gender?.trim() || prev.gender,
        address: info.address?.trim() || prev.address,
        initialHospitalCode: clinic || prev.initialHospitalCode,
        isOcrVerified: true,
      }));
      setScannedThisSession(true);

      // Best effort: the scan is already on screen, so a failed profile write
      // must not interrupt the booking.
      void syncScannedCardToProfile(info, clinic, user, updateUser);
    },
    [user, updateUser],
  );

  /**
   * Send a freshly recorded clip for triage, then adopt whatever comes back.
   *
   * On success the transcription is written into the textarea rather than shown
   * beside it: the patient dictated this text, so it is their own description, and
   * they can still edit it before continuing.
   */
  async function analyseVoiceClip(clip: Blob) {
    setVoiceClip(clip);
    setIsAnalysing(true);
    setScheduleUnavailable(false);
    try {
      const result = await sendVoiceScheduleTriage(clip, triageDate);
      applyVoiceTriage(result);
    } catch (error) {
      handleVoiceTriageFailure(error);
    } finally {
      setIsAnalysing(false);
    }
  }

  /**
   * Adopt a verdict.
   *
   * The department is pre-selected from the triage mapping and the time slot from
   * the recommended shift, but the patient is *not* advanced: an LLM picking a
   * consultant for them is a suggestion, and the whole point of the dispatcher
   * being visible first is that they get to look at it.
   */
  function applyVoiceTriage(result: VoiceScheduleTriageResponse) {
    setVoiceTriage(result);
    const transcript = result.transcription.trim();
    if (transcript) {
      setSymptoms(transcript);
      setTriageSourceText(transcript);
    }
    setSelectedDepartmentId(result.department_id);
    setDeptIdx(serviceIndexForDepartment(result.department_id));
    // A 200 can still mean "the rota service did not answer" - the gateway says so
    // positively rather than erroring, because the clinical half is usable.
    setScheduleUnavailable(result.schedule_connected === false);
    const session = result.recommended_shift;
    if (session === "MORNING" || session === "AFTERNOON") {
      setTimeSlot(SESSION_TIME_SLOTS[session][0]);
    }
  }

  /**
   * Symptoms edited by hand after a verdict was produced.
   *
   * Drops the verdict rather than leaving a stale one on screen: an AI that
   * recommended dermatology for "ngứa tay" must keep saying that only while those
   * words are still there. `deptIdx` and `timeSlot` are deliberately left alone -
   * they are shown and confirmed on the next step, so clearing them here would
   * discard a choice the patient made themselves for no visible reason.
   */
  function handleSymptomsChange(next: string) {
    if (voiceTriage && triageSourceText && next.trim() !== triageSourceText) {
      setVoiceTriage(null);
      setShiftSelection(null);
      setSelectedDepartmentId(null);
      setTriageSourceText("");
      setVoiceClip(null);
    }
    setSymptoms(next);
  }

  /**
   * A triage call that failed.
   *
   * Two very different situations, and saying the same thing for both sends
   * people down the wrong path: an unrecognised clip needs the patient to speak
   * again, while an unreachable gateway needs someone to restart a service -
   * speaking again would change nothing. The messages themselves come from the
   * service, which is where the HTTP status is known.
   *
   * Falling back to `null` hands the screen back to the keyword triage card,
   * which runs entirely locally and therefore cannot be down.
   */
  function handleVoiceTriageFailure(error: unknown) {
    if (error instanceof VoiceTriageError) {
      // Retryable by the patient - gentle, because nothing is broken.
      if (error.kind === "silent") {
        toast.warning(error.message);
        return;
      }
      toast.error(error.message);
      if (error.detail) console.warn("Voice triage:", error.detail);
      return;
    }
    toast.error("Không phân tích được đoạn ghi âm. Vui lòng thử lại.");
  }

  /**
   * Re-run the same clip against another date.
   *
   * The transcription and every field the patient has since typed are left alone:
   * only the rota changes, and it is replaced wholesale by the new answer so a
   * slot that has since filled cannot linger as "available".
   */
  async function refreshSchedule() {
    if (!voiceClip) return;
    setIsRefreshingSchedule(true);
    try {
      const result = await sendVoiceScheduleTriage(voiceClip, triageDate);
      setVoiceTriage(result);
      setScheduleUnavailable(result.schedule_connected === false);
      setShiftSelection(null);
      // The previously selected slot may not exist on the new day.
      setTimeSlot(null);
    } catch (error) {
      // The rota on screen belongs to the old date now, so it must stop being
      // presented as though it answers the one the patient just asked for.
      setScheduleUnavailable(true);
      setShiftSelection(null);
      handleVoiceTriageFailure(error);
    } finally {
      setIsRefreshingSchedule(false);
    }
  }

  /**
   * A shift or doctor picked in the dispatcher.
   *
   * Selecting a doctor implies their session, so one click sets the department
   * (the rota is for that department), a slot inside that half of the day, and the
   * selection itself, then moves on to confirmation. Full sessions and full
   * doctors are not clickable at all, so nothing here has to re-check them.
   */
  function handleSelectShift(session: SessionName, doctorId: number | null) {
    setShiftSelection({ session, doctorId });
    // Re-derive the service from the remembered category rather than trusting
    // `deptIdx`: it may still hold whatever the patient clicked before speaking.
    if (selectedDepartmentId !== null) {
      setDeptIdx(serviceIndexForDepartment(selectedDepartmentId));
    }
    const slots = SESSION_TIME_SLOTS[session];
    if (slots.length > 0) setTimeSlot(slots[0]);
    setStep(2);
  }

  /**
   * The doctor the patient actually chose in the dispatcher, if any.
   *
   * Without this the confirmation screen would re-derive the consultant from the
   * chosen service with `resolveDoctorForService` and print someone the patient
   * never picked - the roster pick would be silently discarded at the last step.
   */
  function dispatchedDoctor(): {
    department: string;
    name: string;
    room: string;
  } | null {
    if (!voiceTriage || !shiftSelection) return null;
    const doctor = sessionScheduleFor(voiceTriage, shiftSelection.session)
      ?.doctors.find((item) => item.doctor_id === shiftSelection.doctorId);
    if (!doctor) return null;
    return {
      department: voiceTriage.department_name,
      name: `${doctor.title} ${doctor.doctor_name}`.trim(),
      room: doctor.room_number,
    };
  }

  function handleVoiceCancel() {
    setIsAnalysing(false);
  }

  function resetBooking() {
    setStep(0);
    setSymptoms("");
    setDeptIdx(null);
    setTimeSlot(null);
    setFormData(formFromSession(user));
    setTicket(null);
    setRescanRequested(false);
    setScannedThisSession(false);
    setVoiceTriage(null);
    setVoiceClip(null);
    setShiftSelection(null);
    setSelectedDepartmentId(null);
    setTriageSourceText("");
    setScheduleUnavailable(false);
    setTriageDate(todayIso());
  }

  function validateStep(): boolean {
    if (step === 0 && !symptoms.trim()) {
      toast.error("Vui lòng chia sẻ một chút về triệu chứng của bạn để chúng tôi hỗ trợ.");
      return false;
    }
    if (step === 1) {
      if (deptIdx === null) {
        toast.error("Vui lòng chọn một chuyên khoa.");
        return false;
      }
      if (!timeSlot) {
        toast.error("Vui lòng chọn khung giờ khám.");
        return false;
      }
    }
    if (step === 2) {
      if (!formData.fullName.trim()) {
        toast.error("Vui lòng cung cấp họ và tên đầy đủ.");
        return false;
      }
      // No phone input exists on this form any more, so the number comes from the
      // account - the same value `formData.phone` is bound to. An account without
      // one is the only way to land here, and the only fix is off this page.
      const contactPhone = formData.phone.trim() || (user?.phone?.trim() ?? "");
      if (contactPhone.length < 8) {
        toast.error(
          "Tài khoản của bạn chưa có số điện thoại. Vui lòng cập nhật tại Hồ sơ cá nhân trước khi đặt lịch.",
        );
        return false;
      }
    }
    return true;
  }

  function handleNext() {
    if (!validateStep()) return;

    if (step === 2) {
      const service: Service =
        deptIdx !== null ? CLINIC_SERVICES[deptIdx] : CLINIC_SERVICES[0];
      const doctor = resolveDoctorForService(service.title);
      // A roster pick from the dispatcher outranks the service-derived fallback.
      const chosen = dispatchedDoctor();
      const confirmed: ActiveAppointment = {
        ticketCode: "#APT-2026-8821",
        patientName: formData.fullName.trim().toUpperCase(),
        department: chosen?.department ?? doctor.department,
        doctor: chosen?.name ?? doctor.name,
        room: chosen?.room ?? doctor.roomNumber,
        date: voiceTriage ? dateLabelFrom(triageDate) : "Hôm nay",
        timeSlot: timeSlot ?? "08:30",
      };
      // The dashboard reads this back: without it the patient would land on
      // "Bạn chưa có lịch hẹn khám nào" right after booking.
      writeActiveBooking(confirmed);
      setTicket(confirmed);
      return;
    }
    setStep((s) => s + 1);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleNext();
  }

  return (
    <div className="min-h-screen bg-surface-light">
      <PatientNavbar />

      <main className="py-10 lg:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-card">
              <Calendar className="h-4 w-4 text-clinical-600" />
              Không cần thanh toán trước &middot; Tiếp nhận cả bệnh nhân vãng lai
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Đặt lịch khám
            </h1>
            <p className="mt-2 text-base leading-relaxed text-slate-500">
              Ba bước nhanh chóng và bạn xong - chúng tôi sẽ xác nhận qua tin
              nhắn SMS.
            </p>
          </div>

          {/* Step indicator */}
          <ol className="mt-8 flex items-center">
            {STEP_LABELS.map((label, index) => {
              const done = index < step;
              const active = index === step;
              return (
                <li key={label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-300 ${
                        done
                          ? "border-clinical-600 bg-clinical-600 text-white"
                          : active
                            ? "border-clinical-600 text-clinical-700"
                            : "border-slate-200 bg-white text-slate-400"
                      }`}
                    >
                      {done ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        active ? "text-slate-900" : "text-slate-500"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {index < STEP_LABELS.length - 1 && (
                    <span className="mx-2 mb-5 h-px flex-1 bg-slate-200 sm:mx-4" />
                  )}
                </li>
              );
            })}
          </ol>

          {/* Step card */}
          <div className="mt-8 rounded-xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8">
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {step === 0 && (
                <SymptomsStep
                  symptoms={symptoms}
                  onChange={handleSymptomsChange}
                  onContinue={handleNext}
                  onOcrExtracted={handleOcrExtracted}
                  identity={formData}
                  onIdentityChange={setFormField}
                  cardOnFile={canSkipScan ? savedCardCode : null}
                  cardVerified={formData.isOcrVerified}
                  onRequestRescan={() => setRescanRequested(true)}
                  voiceTriage={voiceTriage}
                  isAnalysingVoice={isAnalysing}
                  onVoiceClip={analyseVoiceClip}
                  onVoiceCancel={handleVoiceCancel}
                  shiftSelection={shiftSelection}
                  onSelectShift={handleSelectShift}
                  scheduleUnavailable={scheduleUnavailable}
                  triageDate={triageDate}
                  onTriageDateChange={setTriageDate}
                  isRefreshingSchedule={isRefreshingSchedule}
                  onRefreshSchedule={refreshSchedule}
                />
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <p className="mb-3 text-base font-medium text-slate-900">
                      Chọn chuyên khoa
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {CLINIC_SERVICES.map((service, index) => (
                        <button
                          key={service.title}
                          type="button"
                          onClick={() => setDeptIdx(index)}
                          aria-pressed={deptIdx === index}
                          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-base transition-colors ${
                            deptIdx === index
                              ? "border-clinical-600 bg-clinical-50 text-clinical-700"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {service.title}
                          {index === suggestedIdx && (
                            <span className="ml-auto shrink-0 rounded-full bg-triage-p3-bg px-2 py-0.5 text-xs font-semibold text-triage-p3">
                              Đề xuất
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-base font-medium text-slate-900">
                      Chọn khung giờ khám hôm nay
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {TIME_SLOTS.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setTimeSlot(slot)}
                          aria-pressed={timeSlot === slot}
                          className={`inline-flex h-10 items-center rounded-lg border px-4 text-base font-medium transition-colors ${
                            timeSlot === slot
                              ? "border-clinical-600 bg-clinical-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  {formData.isOcrVerified && (
                    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                      <p className="text-sm font-semibold text-teal-800">
                        BHYT Đã xác thực - thông tin đã được tự động điền từ thẻ
                        BHYT
                      </p>
                      <dl className="mt-2 space-y-1 text-sm text-slate-600">
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">Mã thẻ BHYT</dt>
                          <dd className="font-mono font-medium text-slate-800">
                            {formData.insuranceCode}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">Ngày sinh</dt>
                          <dd className="font-medium text-slate-800">
                            {formData.dateOfBirth}
                          </dd>
                        </div>
                        {formData.gender && (
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">Giới tính</dt>
                            <dd className="font-medium text-slate-800">
                              {formData.gender}
                            </dd>
                          </div>
                        )}
                        {formData.address && (
                          <div className="flex justify-between gap-3">
                            <dt className="shrink-0 text-slate-500">Địa chỉ</dt>
                            <dd className="text-right font-medium text-slate-800">
                              {formData.address}
                            </dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">Nơi KCB ban đầu</dt>
                          <dd className="text-right font-medium text-slate-800">
                            {formData.initialHospitalCode}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  {/* Same fields as step 1, on the same state: the scan landed
                      them up there, and this is where the patient checks them
                      before the appointment is written down. */}
                  <BookingIdentityFields
                    value={formData}
                    onChange={setFormField}
                    idPrefix="booking-step3"
                  />

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      Tóm tắt lịch hẹn
                    </p>
                    <dl className="mt-2 space-y-1.5 text-base text-slate-600">
                      <div className="flex justify-between">
                        <dt>Chuyên khoa</dt>
                        <dd className="font-medium text-slate-900">
                          {deptIdx !== null
                            ? CLINIC_SERVICES[deptIdx].title
                            : "Khám Nội Tổng quát & Tầm soát"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Khung giờ</dt>
                        <dd className="font-medium text-slate-900">
                          {timeSlot}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Thanh toán trước</dt>
                        <dd className="font-medium text-slate-900">Không</dd>
                      </div>
                    </dl>
                  </div>

                  <p className="inline-flex items-center gap-2 text-base font-medium text-slate-600">
                    <PhoneCall className="h-5 w-5 text-clinical-600" />
                    Cần hỗ trợ? Gọi tổng đài (028) 1900 123 456
                  </p>
                </div>
              )}

              {/* Navigation */}
              {step > 0 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-5 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Quay lại
                  </button>

                  <button
                    type="submit"
                    className={`inline-flex h-11 items-center justify-center rounded-lg px-6 text-base font-semibold text-white shadow-card transition-all hover:shadow-elevated ${
                      step === 2
                        ? "bg-cta hover:bg-cta-hover"
                        : "bg-clinical-600 hover:bg-clinical-700"
                    }`}
                  >
                    {step === 2 ? "Xác nhận lịch hẹn" : "Tiếp tục"}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </main>

      <PatientFooter />
      <FloatingRagChatbot />

      {ticket && (
        <BookingTicketModal
          appointment={ticket}
          onClose={resetBooking}
        />
      )}
    </div>
  );
}