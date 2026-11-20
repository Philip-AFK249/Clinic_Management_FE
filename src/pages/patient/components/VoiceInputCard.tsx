import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { useAudioRecorder } from "../../../hooks/useAudioRecorder";
import type {
  ClarificationOption,
  RefineVoiceTriagePayload,
  VoiceTriageResult,
} from "../../../services/voiceTriageApi";

interface VoiceInputCardProps {
  value: string;
  onChange: (value: string) => void;
  /** The clip just recorded, handed to the parent so it can re-query another date. */
  onRecorded?: (clip: Blob) => void;
  /** Raised when the patient stops a recording without wanting to submit it. */
  onCancelled?: () => void;
  /**
   * True while the clip is being triaged, so the card can show the Whisper
   * spinner instead of going back to idle while the request is still open.
   */
  isAnalysing?: boolean;
  clarification?: VoiceTriageResult | null;
  isRefining?: boolean;
  onRefineClarification?: (payload: RefineVoiceTriagePayload) => void;
  onSkipClarification?: () => void;
  defaultAgeGroup?: string;
  defaultPatientHistory?: string;
  targetDate?: string;
}

const CATEGORY_LABELS: Record<ClarificationOption["category"], string> = {
  age_group: "Độ tuổi",
  medical_history: "Tiền sử",
  symptom_detail: "Triệu chứng",
};

const CATEGORY_STYLES: Record<ClarificationOption["category"], string> = {
  age_group: "border-amber-200 bg-amber-50 text-amber-700",
  medical_history: "border-violet-200 bg-violet-50 text-violet-700",
  symptom_detail: "border-sky-200 bg-sky-50 text-sky-700",
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

/**
 * Voice entry for the reason-for-visit.
 *
 * Records real audio and hands the clip up; the transcription comes back from the
 * gateway's Whisper stage rather than from a browser recogniser, so what lands in
 * the textarea is the same text the clinical model was given.
 *
 * The textarea stays editable throughout recording: dictation is an aid, not a
 * gate, and a patient who mistypes one word should be able to fix it.
 */
export default function VoiceInputCard({
  value,
  onChange,
  onRecorded,
  onCancelled,
  isAnalysing = false,
  clarification = null,
  isRefining = false,
  onRefineClarification,
  onSkipClarification,
  defaultAgeGroup,
  defaultPatientHistory,
  targetDate,
}: VoiceInputCardProps) {
  const {
    isRecording,
    recordingTime,
    isProcessing,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  } = useAudioRecorder();

  const busy = isProcessing || isAnalysing;

  // Keep the latest callbacks reachable from the recorder's handlers without
  // making those handlers depend on them: they are recreated on every keystroke
  // otherwise. Written in an effect rather than during render, which the hooks
  // lint rules forbid.
  const onRecordedRef = useRef(onRecorded);
  const onCancelledRef = useRef(onCancelled);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
    onCancelledRef.current = onCancelled;
  });

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  async function handleStart() {
    reset();
    try {
      await startRecording();
    } catch {
      // `startRecording` reports its own failures through `error`; this only
      // catches the genuinely unexpected, which the hook cannot describe.
    }
  }

  async function handleStop() {
    const clip = await stopRecording();
    if (!clip) {
      // Too short to be speech, or the patient cancelled mid-finalise.
      reset();
      return;
    }
    onRecordedRef.current?.(clip);
  }

  function handleCancel() {
    cancelRecording();
    onCancelledRef.current?.();
  }

  const options = clarification?.clarification_options ?? [];
  const showClarification =
    clarification?.needs_clarification === true &&
    options.length > 0 &&
    Boolean(onRefineClarification) &&
    Boolean(onSkipClarification);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-clinical-50 text-clinical-600">
          <Mic className="h-5 w-5" />
        </span>
        <label
          htmlFor="booking-symptoms"
          className="text-lg font-semibold text-slate-900"
        >
          Lý do bạn đến khám hôm nay là gì?
        </label>
      </div>
      <p className="mt-2 text-base leading-relaxed text-slate-500">
        Nói trực tiếp hoặc gõ tay - hệ thống sẽ tự động chuyển lời nói thành chữ và
        gợi ý chuyên khoa phù hợp.
      </p>

      <textarea
        id="booking-symptoms"
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ví dụ: Tôi bị nổi mẩn ngứa ở tay một tuần nay, kèm hắt hơi nhiều lúc sáng..."
        className="mt-4 min-h-[160px] w-full rounded-lg border border-slate-200 bg-white p-4 text-base leading-relaxed text-slate-800 placeholder:text-slate-400 transition-colors outline-none focus:border-clinical-600 focus:ring-2 focus:ring-clinical-500/20 md:text-lg"
      />

      {/* Idle: the single mic affordance. */}
      {!isRecording && !busy && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleStart}
            disabled={!isSupported}
            aria-label="Bấm để nói triệu chứng"
            className="group inline-flex items-center gap-3 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="relative flex h-14 w-14 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-clinical-100 transition-transform group-hover:scale-105" />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-clinical-600 text-white shadow-sm transition-colors group-hover:bg-clinical-700">
                <Mic className="h-6 w-6" aria-hidden="true" />
              </span>
            </span>
            <span className="text-left">
              <span className="block text-base font-semibold text-slate-900">
                Bấm để nói triệu chứng
              </span>
              <span className="block text-xs text-slate-500">
                Ghi âm tối đa 60 giây
              </span>
            </span>
          </button>

          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
            Tiếng Việt
          </span>

          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Xóa nội dung
            </button>
          )}
        </div>
      )}

      {/* Recording: live level, elapsed time, and an explicit way out. */}
      {isRecording && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-clinical-100 bg-clinical-50 p-3"
        >
          <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-triage-p1 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-triage-p1" />
          </span>

          <span className="flex h-6 items-center gap-1" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                className="w-1 animate-pulse rounded-full bg-clinical-600"
                style={{
                  height: bar % 2 === 0 ? "0.75rem" : "1.5rem",
                  animationDelay: `${bar * 120}ms`,
                }}
              />
            ))}
          </span>

          <span className="text-base font-medium text-slate-900">
            Đang ghi âm...
          </span>
          <span className="font-mono text-base font-semibold tabular-nums text-clinical-700">
            {formatDuration(recordingTime)}
          </span>

          <span className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex h-12 items-center gap-1.5 rounded-lg bg-clinical-600 px-4 text-base font-medium text-white transition-colors hover:bg-clinical-700"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              Dừng &amp; Phân tích
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex h-12 items-center gap-1.5 rounded-lg px-3 text-base font-medium text-slate-500 transition-colors hover:text-slate-700"
            >
              <MicOff className="h-4 w-4" aria-hidden="true" />
              Hủy
            </button>
          </span>
        </div>
      )}

      {/* Processing: the round trip is two model calls, so the action button is
          what carries the waiting, not a separate notice - the patient is still
          looking for the thing they clicked. */}
      {busy && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled
            aria-busy="true"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-clinical-200 bg-clinical-50 px-5 text-base font-medium text-clinical-700 opacity-80"
          >
            <Loader2
              className="h-5 w-5 animate-spin text-clinical-600"
              aria-hidden="true"
            />
            Đang bóc tách giọng nói &amp; Phân loại lâm sàng...
          </button>
          <p role="status" aria-live="polite" className="text-xs text-slate-500">
            Vui lòng giữ nguyên trang trong giây lát.
          </p>
        </div>
      )}

      {/* A denied microphone cannot recover by itself, so the explanation stays
          on the card rather than living only in a toast that auto-dismisses. */}
      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {!isSupported && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          <Volume2 className="h-4 w-4 shrink-0 text-clinical-600" />
          Trình duyệt này không hỗ trợ ghi âm. Bạn có thể gõ triệu chứng hoặc chọn
          các thẻ triệu chứng nhanh bên dưới.
        </p>
      )}

      {showClarification && clarification && onRefineClarification && onSkipClarification && (
        <ClarificationPanel
          key={`${clarification.transcription}|${options.map((option) => option.id).join(",")}`}
          clarification={clarification}
          options={options}
          isRefining={isRefining}
          defaultAgeGroup={defaultAgeGroup}
          defaultPatientHistory={defaultPatientHistory}
          targetDate={targetDate}
          onRefine={onRefineClarification}
          onSkip={onSkipClarification}
        />
      )}
    </div>
  );
}

function ClarificationPanel({
  clarification,
  options,
  isRefining,
  defaultAgeGroup,
  defaultPatientHistory,
  targetDate,
  onRefine,
  onSkip,
}: {
  clarification: VoiceTriageResult;
  options: ClarificationOption[];
  isRefining: boolean;
  defaultAgeGroup?: string;
  defaultPatientHistory?: string;
  targetDate?: string;
  onRefine: (payload: RefineVoiceTriagePayload) => void;
  onSkip: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [extraNote, setExtraNote] = useState("");

  const selectedOptions = options.filter((option) => selectedIds.includes(option.id));
  const canRefine = selectedOptions.length > 0 || extraNote.trim().length > 0;

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function handleRefine() {
    if (!canRefine || isRefining) return;
    const selectedAge = selectedOptions.find((option) => option.age_group_value);
    onRefine({
      transcription: clarification.transcription,
      selected_options: selectedOptions.map((option) => option.label),
      extra_note: extraNote.trim() || undefined,
      age_group: selectedAge?.age_group_value ?? defaultAgeGroup,
      patient_history: defaultPatientHistory,
      target_date: targetDate || clarification.target_date,
    });
  }

  return (
    <section className="mt-4 rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/80 to-amber-50/60 p-4">
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sky-600 shadow-sm">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            AI cần làm rõ thêm để chọn đúng chuyên khoa
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            {clarification.clarifying_question ||
              "Chọn các thông tin đúng với trường hợp của bạn để AI phân luồng chính xác hơn."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = selectedIds.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(option.id)}
              className={`inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-left text-xs font-semibold shadow-sm transition-colors ${
                selected
                  ? "border-clinical-500 ring-2 ring-clinical-100"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${CATEGORY_STYLES[option.category]}`}
              >
                {CATEGORY_LABELS[option.category]}
              </span>
              <span className="text-slate-800">{option.label}</span>
              {selected && (
                <Check className="h-3.5 w-3.5 shrink-0 text-clinical-600" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">
          Ghi chú thêm (nếu có)...
        </span>
        <input
          type="text"
          value={extraNote}
          onChange={(event) => setExtraNote(event.target.value)}
          placeholder="Ví dụ: đang dùng thuốc huyết áp, khởi phát cách đây 2 giờ..."
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-clinical-500 focus:ring-2 focus:ring-clinical-100"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/70 pt-3">
        <button
          type="button"
          onClick={handleRefine}
          disabled={!canRefine || isRefining}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-clinical-600 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-clinical-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {isRefining && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {isRefining ? "Đang chẩn đoán lại..." : "Xác nhận & Chẩn đoán lại"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={isRefining}
          className="inline-flex h-10 items-center justify-center rounded-lg px-2 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Bỏ qua, dùng chẩn đoán hiện tại
        </button>
      </div>
    </section>
  );
}
