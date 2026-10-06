import { useEffect, useRef } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Square,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { useAudioRecorder } from "../../../hooks/useAudioRecorder";

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
}

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
              Hoàn tất &amp; Phân tích
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

      {/* Processing: the round trip is two model calls, so say what is happening. */}
      {busy && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-3 rounded-xl border border-clinical-100 bg-clinical-50 p-4"
        >
          <Loader2
            className="h-5 w-5 shrink-0 animate-spin text-clinical-600"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-slate-700">
            Đang bóc tách giọng nói (Whisper) &amp; Tham vấn phác đồ Y tế...
          </p>
        </div>
      )}

      {!isSupported && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          <Volume2 className="h-4 w-4 shrink-0 text-clinical-600" />
          Trình duyệt này không hỗ trợ ghi âm. Bạn có thể gõ triệu chứng hoặc chọn
          các thẻ triệu chứng nhanh bên dưới.
        </p>
      )}
    </div>
  );
}
