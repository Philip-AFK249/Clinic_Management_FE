import { useState } from "react";
import { ArrowRight, RefreshCw, ShieldCheck, Sparkles, UserRound } from "lucide-react";
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
import type { BhyTelemetry } from "../data/patientMockRecords";
import type {
  SessionName,
  VoiceScheduleTriageResponse,
} from "../../../services/voiceTriageApi";

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
  /** The recorded clip, which the parent re-uploads to re-query another date. */
  onVoiceClip?: (clip: Blob) => void;
  onVoiceCancel?: () => void;
  /** Shift + doctor picked in the dispatcher, echoed back for the pressed state. */
  shiftSelection?: { session: SessionName; doctorId: number | null } | null;
  onSelectShift?: (session: SessionName, doctorId: number | null) => void;
  scheduleUnavailable?: boolean;
  triageDate?: string;
  onTriageDateChange?: (date: string) => void;
  isRefreshingSchedule?: boolean;
  onRefreshSchedule?: () => void;
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
  onVoiceClip,
  onVoiceCancel,
  shiftSelection = null,
  onSelectShift,
  scheduleUnavailable = false,
  triageDate = "",
  onTriageDateChange,
  isRefreshingSchedule = false,
  onRefreshSchedule,
}: SymptomsStepProps) {
  const [triageAck, setTriageAck] = useState(false);

  /**
   * Only one department recommendation may be on screen.
   *
   * The keyword matcher and the clinical LLM both answer "where should you go",
   * and they disagree often enough that showing both makes the form look broken.
   * A real transcription beats keyword matching on the same text, so the voice
   * verdict replaces it - but only replaces the *card*; the typed symptoms and
   * the acknowledgement gate below are shared by both.
   */
  const suggestion = voiceTriage ? null : triageSymptoms(symptoms);
  const hasSymtoms = symptoms.trim().length > 0;
  /** Whichever disclaimer is actually rendered has to be acknowledged. */
  const needsAck = Boolean(suggestion ?? voiceTriage);
  const canContinue = hasSymtoms && (!needsAck || triageAck);

  function handleChipSelect(value: string) {
    onChange(symptoms.trim() ? `${symptoms.trimEnd()}, ${value}` : value);
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
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
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
      />

      <div>
        <p className="mb-2 text-base font-medium text-slate-900">
          Chạm để thêm triệu chứng nhanh
        </p>
        <QuickSymptomChips onSelect={handleChipSelect} />
      </div>

      {/* Exactly one of these two renders; see `suggestion` above. */}
      {voiceTriage ? (
        <ShiftDispatcherCard
          triage={voiceTriage}
          selected={shiftSelection}
          onSelect={(session, doctorId) => onSelectShift?.(session, doctorId)}
          scheduleUnavailable={scheduleUnavailable}
          targetDate={triageDate}
          onTargetDateChange={(date) => onTriageDateChange?.(date)}
          isRefreshing={isRefreshingSchedule}
          onRefresh={() => onRefreshSchedule?.()}
          acknowledged={triageAck}
          onAcknowledge={setTriageAck}
        />
      ) : (
        <TriageResultCard
          suggestion={suggestion}
          acknowledged={triageAck}
          onAcknowledge={setTriageAck}
        />
      )}

      {/* Deferred AI indicator */}
      <div className="flex items-start gap-3 rounded-xl border border-clinical-100 bg-clinical-50 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-clinical-600">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-semibold text-slate-900">
            Chưa chắc nên chọn chuyên khoa nào?
          </p>
          <p className="mt-1 text-base leading-relaxed text-slate-600">
            Chạm micro ở trên để nói triệu chứng, hoặc gõ tay như bình thường - Trợ
            lý Ảo Y khoa AI sẽ tự động gợi ý chuyên khoa phù hợp nhất cùng mức độ
            ưu tiên khám và lịch khám còn trống.
          </p>
        </div>
      </div>

      {/* Primary navigation */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-cta px-8 text-lg font-semibold text-white shadow-sm transition-all hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Tiếp tục chọn chuyên khoa
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}