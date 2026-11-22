import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import VoiceInputCard from "./VoiceInputCard";
import QuickSymptomChips from "./QuickSymptomChips";
import BhyTOcrUpload from "./BhyTOcrUpload";
import BhyCardPreview from "./BhyCardPreview";
import BookingIdentityFields from "./BookingIdentityFields";
import type { BookingIdentityFieldsValue } from "./BookingIdentityFields";
import TriageResultCard from "./TriageResultCard";
import ShiftDispatcherCard from "./ShiftDispatcherCard";
import { triageSymptoms } from "../data/patientMockRecords";
import { dobLabelFrom, GENDER_OPTIONS, genderFrom, hospitalLabelFrom } from "../data/patientProfile";
import type { BhyTelemetry, TriageSuggestion } from "../data/patientMockRecords";
import type {
  ClarificationOption,
  ClarifyingQuestionItem,
  SessionName,
  VoiceScheduleTriageResponse,
  VoiceTriageResult,
} from "../../../services/voiceTriageApi";
import type { TimeSlotResponse } from "../../../services/intakeApi";
import type { ShiftSelection } from "./ShiftDispatcherCard";
import BookingSlotChips from "./BookingSlotChips";
import { isMorningSessionElapsed, isSlotElapsed } from "../data/bookingSlots";
import { CLINIC_SERVICES } from "../data/clinicContent";

export interface ClarificationStep {
  question: string;
  options: ClarificationOption[];
  selectedAnswer: string;
  selectedOptionId?: string;
  detectedAgeGroup?: string | null;
}

const PRIORITY_LABELS: Record<TriageSuggestion["priority"], string> = {
  P1: "P1 - Khẩn cấp (Ưu tiên 1)",
  P2: "P2 - Cần khám sớm",
  P3: "P3 - Khám thông thường",
};

interface SymptomsStepProps {
  symptoms: string;
  onChange: (value: string) => void;
  onContinue: () => void;
  onOcrExtracted: (info: BhyTelemetry) => void;
  /** The identity slice of the booking form, autofilled from the card. */
  identity: BookingIdentityFieldsValue;
  onIdentityChange: <K extends keyof BookingIdentityFieldsValue>(
    field: K,
    next: BookingIdentityFieldsValue[K],
  ) => void;
  /**
   * The card number already on this patient's profile, or `null` to ask for a
   * scan. A non-empty value means the scanner is replaced by the saved card and
   * its rescan action - the same photo should not be asked for twice.
   */
  cardOnFile?: string | null;
  /**
   * Whether that card came from an actual scan. False for a number the patient
   * typed in, which must not be badged as verified.
   */
  cardVerified?: boolean;
  /** Offer the scanner again, for a card that has changed or been misread. */
  onRequestRescan?: () => void;
  /** The voice triage verdict, or `null` until a recording has been analysed. */
  voiceTriage?: VoiceScheduleTriageResponse | null;
  isAnalysingVoice?: boolean;
  isAnalysingText?: boolean;
  onAnalyzeText?: (text: string) => void;
  triageError?: string | null;
  onRetryTriage?: () => void;
  clarification?: VoiceTriageResult | null;
  clarificationSteps?: ClarificationStep[];
  isRefiningVoice?: boolean;
  onClarificationAnswer?: (answer: {
    answer: string;
    optionId?: string;
  }) => void;
  onClarificationBack?: () => void;
  onClarificationSkip?: () => void;
  activeClarificationIndex?: number;
  clarificationAnswers?: Record<string, string>;
  onClarificationIndexChange?: (index: number) => void;
  onClarificationAnswerChange?: (questionId: string, answer: string) => void;
  onClarificationClose?: () => void;
  onClarificationSkipCurrent?: () => void;
  onClarificationSubmit?: () => void;
  /** The recorded clip, which the parent re-uploads to re-query another date. */
  onVoiceClip?: (clip: Blob) => void;
  onVoiceCancel?: () => void;
  /** Shift + doctor + hour picked in the dispatcher, echoed for the pressed state. */
  shiftSelection?: ShiftSelection | null;
  onSelectShift?: (
    session: SessionName,
    doctorId: number | null,
    slotStartTime: string,
  ) => void;
  /**
   * The doctor the patient explicitly tapped, or `null` for automatic load
   * balancing. Lifted here so the booking page can send it as
   * `preferredDoctorId` instead of letting the intake service pick someone.
   */
  selectedDoctorId?: number | null;
  onSelectDoctor?: (doctorId: number | null) => void;
  /** Live slot grid for the triage department/date, disabling full chips. */
  slotAvailability?: TimeSlotResponse[] | null;
  /** Keyword path: chosen department index in `CLINIC_SERVICES`, `null` = none. */
  deptIdx?: number | null;
  onDeptIdxChange?: (index: number) => void;
  /** The hour the booking will be made for, `HH:mm`, or `null` when none. */
  slotStartTime?: string | null;
  /** Keyword path: a 60-minute chip pressed (the dispatcher path uses `onSelectShift`). */
  onSlotPick?: (slot: string) => void;
  scheduleUnavailable?: boolean;
  triageDate?: string;
  onTriageDateChange?: (date: string) => void;
  isRefreshingSchedule?: boolean;
  onOpenBillOcr?: () => void;
  medicalBillSummary?: string;
  detectedMedications?: string[];
  allergyHints?: string[];
  /**
   * The booking page opened at/after the 17:00 closing time, so the date
   * started on tomorrow. Drives the auto-shift banner below.
   */
  afterHours?: boolean;
}

export default function SymptomsStep({
  symptoms,
  onChange,
  onContinue,
  onOcrExtracted,
  identity,
  onIdentityChange,
  cardOnFile = null,
  cardVerified = false,
  onRequestRescan,
  voiceTriage = null,
  isAnalysingVoice = false,
  isAnalysingText = false,
  onAnalyzeText,
  triageError = null,
  onRetryTriage,
  clarification = null,
  clarificationSteps = [],
  isRefiningVoice = false,
  onClarificationAnswer,
  onClarificationBack,
  onClarificationSkip,
  activeClarificationIndex = 0,
  clarificationAnswers = {},
  onClarificationIndexChange,
  onClarificationAnswerChange,
  onClarificationClose,
  onClarificationSkipCurrent,
  onClarificationSubmit,
  onVoiceClip,
  onVoiceCancel,
  shiftSelection = null,
  onSelectShift,
  selectedDoctorId = null,
  onSelectDoctor,
  slotAvailability = null,
  deptIdx = null,
  onDeptIdxChange,
  slotStartTime = null,
  onSlotPick,
  scheduleUnavailable = false,
  triageDate = "",
  onTriageDateChange,
  isRefreshingSchedule = false,
  onOpenBillOcr,
  medicalBillSummary = "",
  detectedMedications = [],
  allergyHints = [],
  afterHours = false,
}: SymptomsStepProps) {
  const [triageAck, setTriageAck] = useState(false);
  const [customAnswer, setCustomAnswer] = useState("");

  const clarificationQuestion = (clarification?.clarifying_question ?? "").trim();
  const clarificationOptions = clarification?.clarification_options ?? [];
  const clarifyingQuestions: ClarifyingQuestionItem[] =
    clarification?.clarifying_questions ?? [];
  const hasMultiQuestionCard =
    clarification?.needs_clarification === true && clarifyingQuestions.length > 0;
  const activeClarificationIndexSafe = hasMultiQuestionCard
    ? Math.min(
        Math.max(activeClarificationIndex, 0),
        clarifyingQuestions.length - 1,
      )
    : 0;
  const activeQuestion = hasMultiQuestionCard
    ? clarifyingQuestions[activeClarificationIndexSafe]
    : null;
  const answeredCount = clarifyingQuestions.filter((question) =>
    Boolean((clarificationAnswers[question.id] ?? "").trim()),
  ).length;
  const hasLegacyCard =
    clarification?.needs_clarification === true &&
    !hasMultiQuestionCard &&
    (Boolean(clarificationQuestion) || clarificationOptions.length > 0) &&
    Boolean(onClarificationAnswer);
  const clarificationStepIndex = Math.min(
    3,
    Math.max(0, clarificationSteps.length - 1),
  );
  const preliminaryResult =
    voiceTriage?.needs_clarification === true ? voiceTriage : clarification;
  const isClarifying = hasMultiQuestionCard || hasLegacyCard;

  const voiceSuggestion: TriageSuggestion | null =
    voiceTriage && !isClarifying
      ? {
          department: voiceTriage.department_name || "Khối Nội",
          priority: voiceTriage.priority_level ?? "P3",
          priorityLabel:
            PRIORITY_LABELS[voiceTriage.priority_level] ?? PRIORITY_LABELS.P3,
          confidence: Math.round((voiceTriage.similarity_score ?? 0.92) * 100),
          summary: [
            voiceTriage.chief_complaint_summary,
            voiceTriage.disease_guess,
            voiceTriage.advice,
          ]
            .filter(Boolean)
            .join(" — "),
        }
      : null;
  const suggestion = voiceTriage ? voiceSuggestion : triageSymptoms(symptoms);
  const finalTriage = voiceTriage
    ? {
        ...voiceTriage,
        priority_level: voiceTriage.priority_level ?? "P3",
        recommended_shift: voiceTriage.recommended_shift ?? "MANUAL_PICK",
      }
    : null;
  const hasSymtoms = symptoms.trim().length > 0;
  /** Whichever disclaimer is actually rendered has to be acknowledged. */
  const needsAck = Boolean(suggestion ?? voiceTriage);
  const hasSlot = Boolean(slotStartTime);
  const canContinue = hasSymtoms && (!needsAck || triageAck) && hasSlot;

  const multiSpecialty =
    voiceTriage && voiceTriage.secondary_department_id
      ? {
          primaryDepartmentName: voiceTriage.department_name,
          secondaryDepartmentName:
            voiceTriage.secondary_department_name ?? "Khối khám kèm",
          note: voiceTriage.multi_specialty_note ?? null,
        }
      : null;

  function handleChipSelect(value: string) {
    onChange(symptoms.trim() ? `${symptoms.trimEnd()}, ${value}` : value);
  }

  function submitCustomAnswer() {
    const answer = customAnswer.trim();
    if (!answer || isRefiningVoice || !onClarificationAnswer) return;
    setCustomAnswer("");
    onClarificationAnswer({ answer });
  }

  function handleClarificationBackClick() {
    setCustomAnswer("");
    onClarificationBack?.();
  }

  function pickQuestionOption(question: ClarifyingQuestionItem, option: string) {
    onClarificationAnswerChange?.(question.id, option);
    if (activeClarificationIndexSafe < clarifyingQuestions.length - 1) {
      onClarificationIndexChange?.(activeClarificationIndexSafe + 1);
    }
  }

  // The card prints `Nam` / `Nữ`; the form stores the enum behind a select, so
  // fold it to the label rather than shipping a third gender-name table.
  const cardGender = identity.gender
    ? (GENDER_OPTIONS.find((o) => o.value === genderFrom(identity.gender))?.label ??
      "")
    : "";

  return (
    <div className="space-y-5">
      {cardOnFile ? (
        <section className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-900">
                Thẻ BHYT đã lưu trong hồ sơ
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Thông tin bên dưới đã được điền sẵn từ lần quét trước. Kiểm tra
                lại, hoặc quét lại nếu bạn đã đổi thẻ.
              </p>
            </div>
          </div>

          <BhyCardPreview
            fullName={identity.fullName}
            insuranceCode={cardOnFile}
            dateOfBirthLabel={dobLabelFrom(identity.dateOfBirth)}
            gender={cardGender}
            address={identity.address}
            hospital={hospitalLabelFrom(identity.initialHospitalCode)}
            verified={cardVerified}
          />

          {onRequestRescan && (
            <button
              type="button"
              onClick={onRequestRescan}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Quét lại thẻ BHYT
            </button>
          )}
        </section>
      ) : (
        <BhyTOcrUpload onExtracted={onOcrExtracted} />
      )}

      {/* Directly under the scanner so the patient watches the fields land as the
          card is read, and can correct anything the model got wrong before
          moving on. */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-clinical-50 text-clinical-600">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Thông tin bệnh nhân
            </h2>
            <p className="text-xs text-slate-500">
              Quét thẻ BHYT ở trên để tự động điền, hoặc nhập tay nếu bạn không có
              thẻ.
            </p>
          </div>
        </div>
        <BookingIdentityFields
          value={identity}
          onChange={onIdentityChange}
          idPrefix="booking-step1"
        />
      </section>

      <VoiceInputCard
        value={symptoms}
        onChange={onChange}
        onRecorded={onVoiceClip}
        onCancelled={onVoiceCancel}
        isAnalysing={isAnalysingVoice}
        isAnalysingText={isAnalysingText}
        onAnalyzeText={onAnalyzeText}
        triageError={triageError}
        onRetryTriage={onRetryTriage}
      />

      {isClarifying && preliminaryResult && !hasMultiQuestionCard && (
        <section
          className="space-y-3 rounded-xl border border-clinical-200 bg-gradient-to-r from-clinical-50 via-white to-sky-50 p-4"
          aria-label="Tóm tắt phân luồng bước đầu"
        >
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-clinical-600 shadow-sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">
                AI đã hiểu triệu chứng của bạn
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                {preliminaryResult.chief_complaint_summary ||
                  symptoms.trim() ||
                  "Đang tổng hợp triệu chứng..."}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-clinical-200 bg-white px-2.5 py-1 text-xs font-bold text-clinical-700">
              {preliminaryResult.priority_level ?? "P3"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              <Stethoscope className="h-3.5 w-3.5 text-clinical-600" aria-hidden="true" />
              {preliminaryResult.department_name || "Đang xác định khối khám"}
            </span>
            {(preliminaryResult.secondary_department_name ||
              preliminaryResult.multi_specialty_note) && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Đa cơ quan · khám kèm:{" "}
                {preliminaryResult.secondary_department_name || "Khối khám kèm"}
              </span>
            )}
          </div>

          {preliminaryResult.multi_specialty_note && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs font-medium leading-relaxed text-sky-900">
              {preliminaryResult.multi_specialty_note}
            </p>
          )}
        </section>
      )}

      {hasMultiQuestionCard && activeQuestion && (
        <section
          key={activeQuestion.id}
          className="animate-fade-rise overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg motion-reduce:animate-none"
          aria-label="Làm rõ triệu chứng"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="min-w-0 text-base font-semibold leading-snug text-slate-900">
              {activeQuestion.question}
            </h3>
            <div className="flex shrink-0 items-center gap-2">
              <div className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  aria-label="Câu trước"
                  onClick={() =>
                    onClarificationIndexChange?.(activeClarificationIndexSafe - 1)
                  }
                  disabled={activeClarificationIndexSafe === 0 || isRefiningVoice}
                  className="flex h-8 w-7 items-center justify-center rounded-l-lg transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <span className="px-1.5 tabular-nums">
                  {activeClarificationIndexSafe + 1} of {clarifyingQuestions.length}
                </span>
                <button
                  type="button"
                  aria-label="Câu sau"
                  onClick={() =>
                    onClarificationIndexChange?.(activeClarificationIndexSafe + 1)
                  }
                  disabled={
                    activeClarificationIndexSafe === clarifyingQuestions.length - 1 ||
                    isRefiningVoice
                  }
                  className="flex h-8 w-7 items-center justify-center rounded-r-lg transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                aria-label="Đóng làm rõ"
                onClick={onClarificationClose}
                disabled={isRefiningVoice}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div>
            {activeQuestion.options.slice(0, 4).map((option, index) => {
              const selected =
                (clarificationAnswers[activeQuestion.id] ?? "") === option;
              return (
                <button
                  key={`${activeQuestion.id}-${index}`}
                  type="button"
                  aria-pressed={selected}
                  disabled={isRefiningVoice}
                  onClick={() => pickQuestionOption(activeQuestion, option)}
                  className={`flex w-full items-center gap-3 border-b border-slate-100 px-5 py-3 text-left transition-colors last:border-b-0 disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected ? "bg-amber-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                      selected
                        ? "bg-cta text-white"
                        : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm text-slate-800">{option}</span>
                </button>
              );
            })}
          </div>

          {activeQuestion.allow_custom !== false && (
            <div className="px-5 py-3">
              <input
                type="text"
                value={clarificationAnswers[activeQuestion.id] ?? ""}
                onChange={(event) =>
                  onClarificationAnswerChange?.(
                    activeQuestion.id,
                    event.target.value,
                  )
                }
                disabled={isRefiningVoice}
                placeholder="Hoặc nhập câu trả lời khác cho câu hỏi này..."
                aria-label="Hoặc nhập câu trả lời khác cho câu hỏi này..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cta focus:bg-white focus:outline-none focus:ring-2 focus:ring-cta/15 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              AI đặt {clarifyingQuestions.length} câu hỏi làm rõ dựa trên mô tả của
              bạn · Đã trả lời {answeredCount}/{clarifyingQuestions.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClarificationSkipCurrent}
                disabled={isRefiningVoice}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Bỏ qua
              </button>
              <button
                type="button"
                onClick={onClarificationSubmit}
                disabled={isRefiningVoice}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-cta px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefiningVoice ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowUp size={15} aria-hidden="true" />
                )}
                {isRefiningVoice ? "Đang gửi..." : "Hoàn tất"}
              </button>
            </div>
          </div>
        </section>
      )}

      {hasLegacyCard && (
        <section
          key={clarificationQuestion}
          className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-card"
          aria-label="Làm rõ triệu chứng"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleClarificationBackClick}
              disabled={isRefiningVoice || clarificationSteps.length <= 1}
              className="inline-flex items-center gap-1 self-start text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              ← Quay lại
            </button>
            <div className="sm:text-right">
              <p className="text-xs font-bold text-slate-800">
                Làm rõ triệu chứng · Câu {clarificationStepIndex + 1}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                AI đang thu hẹp triệu chứng dựa trên dữ liệu y khoa
              </p>
              <div className="mt-2 flex justify-start gap-1 sm:justify-end" aria-hidden="true">
                {[0, 1, 2, 3].map((dot) => (
                  <span
                    key={dot}
                    className={`h-1.5 rounded-full transition-all ${
                      dot <= clarificationStepIndex
                        ? "w-4 bg-slate-800"
                        : "w-1.5 bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <p className="text-sm font-semibold leading-relaxed text-slate-900">
            {clarificationQuestion}
          </p>

          {clarificationOptions.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label={clarificationQuestion}>
              {clarificationOptions.slice(0, 4).map((option) => {
                const selected =
                  clarificationSteps[clarificationStepIndex]?.selectedOptionId ===
                  option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={isRefiningVoice}
                    onClick={() => onClarificationAnswer?.({ answer: option.label, optionId: option.id })}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? "border-slate-800 bg-slate-50"
                        : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected ? "border-slate-800 bg-slate-800" : "border-slate-300"
                      }`}
                      aria-hidden="true"
                    >
                      {selected && <Check size={10} className="text-white" />}
                    </span>
                    <span className="text-xs font-semibold leading-relaxed text-slate-700">
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
            <input
              type="text"
              value={customAnswer}
              onChange={(event) => setCustomAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitCustomAnswer();
              }}
              disabled={isRefiningVoice}
              placeholder="Hoặc nhập câu trả lời khác..."
              aria-label="Hoặc nhập câu trả lời khác..."
              className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200 disabled:bg-slate-50"
            />
            <button
              type="button"
              onClick={submitCustomAnswer}
              disabled={isRefiningVoice || !customAnswer.trim()}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRefiningVoice ? (
                <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
              ) : null}
              Tiếp tục
            </button>
          </div>

          <button
            type="button"
            onClick={onClarificationSkip}
            disabled={isRefiningVoice}
            className="inline-flex text-xs font-semibold text-clinical-700 underline decoration-clinical-300 underline-offset-2 transition-colors hover:text-clinical-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bỏ qua hỏi thêm &amp; xem gợi ý ngay
          </button>
        </section>
      )}

      <div>
        <p className="mb-2 text-base font-medium text-slate-900">
          Chạm để thêm triệu chứng nhanh
        </p>
        <QuickSymptomChips onSelect={handleChipSelect} />
      </div>

      {onOpenBillOcr && (
        <section className="rounded-xl border border-slate-200/80 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-clinical-50 text-clinical-600">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Có hóa đơn khám chữa bệnh cũ?
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Quét biên lai viện phí hoặc hóa đơn thuốc để bác sĩ biết bạn
                  đã dùng thuốc gì. Bạn sẽ kiểm tra lại trước khi dùng.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenBillOcr}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-clinical-300 bg-white px-4 text-sm font-semibold text-clinical-700 transition-colors hover:bg-clinical-50"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Quét hóa đơn cũ
            </button>
          </div>
          {(medicalBillSummary ||
            detectedMedications.length > 0 ||
            allergyHints.length > 0) && (
            <div className="mt-4 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              {medicalBillSummary && <p>{medicalBillSummary}</p>}
              {detectedMedications.length > 0 && (
                <p>
                  <span className="font-bold">Thuốc đã dùng:</span>{" "}
                  {detectedMedications.join(", ")}
                </p>
              )}
              {allergyHints.length > 0 && (
                <p>
                  <span className="font-bold">Dị ứng ghi nhận:</span>{" "}
                  {allergyHints.join(", ")}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* After the 17:00 closing time (or when the rota itself points at the
          next day), the whole form is already scoped to tomorrow - say so
          rather than let the date jump look like a misread. */}
      {(afterHours || voiceTriage?.recommended_shift === "NEXT_DAY") && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-clinical-200 bg-clinical-50 p-4 text-sm font-medium leading-relaxed text-clinical-800"
        >
          <CalendarClock
            className="mt-0.5 h-4 w-4 shrink-0 text-clinical-600"
            aria-hidden="true"
          />
          <span>
            Đã qua 17:00 (hết ca làm việc hôm nay). Hệ thống đã tự động chọn
            lịch khám cho ngày mai.
          </span>
        </p>
      )}

      {/* Exactly one of these two renders; see `suggestion` above. On the voice
          path the multi-specialty alert rides above the dispatcher, which is
          where the booking slot selector lives - and renders nothing at all
          when the verdict flagged no second department. */}
      {!isClarifying && finalTriage ? (
        <>
          <TriageResultCard
            suggestion={voiceSuggestion}
            multiSpecialty={multiSpecialty}
            isOutOfDataset={finalTriage.is_out_of_dataset === true}
            acknowledged={triageAck}
            onAcknowledge={setTriageAck}
          />
          <ShiftDispatcherCard
            triage={finalTriage}
            selected={shiftSelection}
            onSelect={(session, doctorId, slot) =>
              onSelectShift?.(session, doctorId, slot)
            }
            selectedDoctorId={selectedDoctorId}
            onSelectDoctor={onSelectDoctor}
            scheduleUnavailable={scheduleUnavailable}
            targetDate={triageDate}
            onTargetDateChange={(date) => onTriageDateChange?.(date)}
            isRefreshing={isRefreshingSchedule}
            slotAvailability={slotAvailability}
            acknowledged={triageAck}
            onAcknowledge={setTriageAck}
          />
        </>
      ) : (
        <TriageResultCard
          suggestion={suggestion}
          acknowledged={triageAck}
          onAcknowledge={setTriageAck}
        />
      )}

      {/* Without a rota payload there is no dispatcher to hang the picks on, so
          the department and the 60-minute hour live here instead - the same
          two choices the voice path makes inside its session cards. */}
      {!voiceTriage && (
        <section className="rounded-xl border border-slate-200/80 bg-white p-5">
          <p className="mb-3 text-base font-medium text-slate-900">
            Chọn khối khám
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CLINIC_SERVICES.map((service, index) => (
              <button
                key={service.title}
                type="button"
                onClick={() => onDeptIdxChange?.(index)}
                aria-pressed={deptIdx === index}
                className={`flex items-center rounded-lg border px-4 py-3 text-left text-base transition-colors ${
                  deptIdx === index
                    ? "border-clinical-600 bg-clinical-50 text-clinical-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {service.title}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-4 text-base font-medium text-slate-900">
            Chọn khung giờ khám
          </p>
          <BookingSlotChips
            value={slotStartTime}
            onSelect={(slot) => onSlotPick?.(slot)}
            targetDate={triageDate}
            isDisabled={(slot) => {
              if (!triageDate) return false;
              // An elapsed morning today stays tappable so it can open the
              // one-tap "move to tomorrow" prompt instead of looking frozen.
              if (slot < "12:00" && isMorningSessionElapsed(triageDate)) {
                return false;
              }
              return isSlotElapsed(triageDate, slot);
            }}
          />
        </section>
      )}

      {/* Deferred AI indicator */}
      <div className="flex items-start gap-3 rounded-xl border border-clinical-100 bg-clinical-50 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-clinical-600">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-semibold text-slate-900">
            Chưa chắc nên chọn khối khám nào?
          </p>
          <p className="mt-1 text-base leading-relaxed text-slate-600">
            Chạm micro ở trên để nói triệu chứng, gõ tay hoặc bấm "Phân tích &amp;
            gợi ý chẩn đoán" - Trợ lý Ảo Y khoa AI sẽ gợi ý khối khám phù hợp
            nhất cùng mức độ ưu tiên khám và lịch khám còn trống.
          </p>
        </div>
      </div>

      {/* Primary navigation */}
      <div className="flex flex-col items-end gap-2 pt-1">
        {!hasSlot && (
          <p className="text-sm font-medium text-amber-700">
            Chọn một khung giờ khám 60 phút để tiếp tục.
          </p>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-cta px-8 text-lg font-semibold text-white shadow-sm transition-all hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Tiếp tục xác nhận
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}