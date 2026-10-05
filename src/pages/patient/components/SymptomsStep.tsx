import { useState } from "react";
import { ArrowRight, Sparkles, UserRound } from "lucide-react";
import VoiceInputCard from "./VoiceInputCard";
import QuickSymptomChips from "./QuickSymptomChips";
import BhyTOcrUpload from "./BhyTOcrUpload";
import BookingIdentityFields from "./BookingIdentityFields";
import type { BookingIdentityFieldsValue } from "./BookingIdentityFields";
import TriageResultCard from "./TriageResultCard";
import { triageSymptoms } from "../data/patientMockRecords";
import type { BhyTelemetry } from "../data/patientMockRecords";

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
}

export default function SymptomsStep({
  symptoms,
  onChange,
  onContinue,
  onOcrExtracted,
  identity,
  onIdentityChange,
}: SymptomsStepProps) {
  const [triageAck, setTriageAck] = useState(false);

  const suggestion = triageSymptoms(symptoms);
  const hasSymtoms = symptoms.trim().length > 0;
  const canContinue = hasSymtoms && (!suggestion || triageAck);

  function handleChipSelect(value: string) {
    onChange(symptoms.trim() ? `${symptoms.trimEnd()}, ${value}` : value);
  }

  return (
    <div className="space-y-5">
      <BhyTOcrUpload onExtracted={onOcrExtracted} />

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

      <VoiceInputCard value={symptoms} onChange={onChange} />

      <div>
        <p className="mb-2 text-base font-medium text-slate-900">
          Chạm để thêm triệu chứng nhanh
        </p>
        <QuickSymptomChips onSelect={handleChipSelect} />
      </div>

      <TriageResultCard
        suggestion={suggestion}
        acknowledged={triageAck}
        onAcknowledge={setTriageAck}
      />

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
            Ngay khi bạn gửi triệu chứng, Trợ lý Ảo Y khoa AI sẽ tự động gợi ý
            chuyên khoa phù hợp nhất cùng mức độ ưu tiên khám.
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