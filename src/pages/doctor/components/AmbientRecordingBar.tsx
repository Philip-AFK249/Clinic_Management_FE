import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { toast } from "sonner";
import { useAudioRecorder } from "../../../hooks/useAudioRecorder";
import type { ConsultationStatus } from "../hooks/useAmbientConsultation";

interface AmbientRecordingBarProps {
  status: ConsultationStatus;
  /** Microphone opened; the workspace flips to RECORDING. */
  onStart: () => void;
  /**
   * The transient in-memory clip is handed over exactly once, then the caller
   * uploads it to the AI Gateway. It is never persisted anywhere.
   */
  onFinish: (audioBlob: Blob) => void;
  /** Capture stopped and the session discarded without analysis. */
  onAbort: () => void;
}

/** Fixed wave silhouette; the pulse animation does the rest. */
const WAVE_BARS = [12, 20, 28, 16, 26, 14, 22];

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export default function AmbientRecordingBar({
  status,
  onStart,
  onFinish,
  onAbort,
}: AmbientRecordingBarProps) {
  const recorder = useAudioRecorder();
  /**
   * Two things show this banner: the recorder still flushing the clip, and the
   * gateway analysing it. Both are the same wait for the doctor.
   */
  const isProcessing = status === "ANALYZING" || recorder.isProcessing;

  async function handleStart() {
    const started = await recorder.startRecording();
    if (!started) {
      toast.error(
        recorder.error ??
          "Không mở được microphone. Vui lòng cấp quyền truy cập micro.",
        { duration: 6000 },
      );
      return;
    }
    onStart();
  }

  async function handleFinish() {
    const audioBlob = await recorder.stopRecording();
    if (!audioBlob) {
      recorder.reset();
      toast.error(
        "Chưa có dữ liệu âm thanh để phân tích. Vui lòng nói to hơn và thử lại.",
        { duration: 5000 },
      );
      onAbort();
      return;
    }
    onFinish(audioBlob);
  }

  function handleAbort() {
    recorder.cancelRecording();
    recorder.reset();
    onAbort();
    toast.info("Đã dừng ghi âm. Phiên phân tích được hủy, hồ sơ chưa thay đổi.");
  }

  if (status === "IDLE") {
    return (
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            Trợ lý AI lắng nghe cuộc đối thoại lâm sàng để tự động soạn bệnh án
            SOAP &amp; gợi ý mã ICD-10. Tệp ghi âm chỉ tồn tại trong phiên làm
            việc này và không được lưu xuống máy.
          </p>
          {recorder.error && (
            <p className="mt-1 text-xs font-semibold text-red-600">
              {recorder.error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={!recorder.isSupported}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          <Mic className="h-4 w-4" aria-hidden="true" />
          Bật Ghi Âm
        </button>
      </div>
    );
  }

  if (status === "RECORDING") {
    return (
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          ĐANG THU ÂM CUỘC KHÁM
        </span>

        {/* Pulsating green wave */}
        <span className="flex h-8 items-center gap-1" aria-hidden="true">
          {WAVE_BARS.map((height, index) => (
            <span
              key={index}
              className="w-1.5 animate-pulse rounded-full bg-emerald-500"
              style={{ height: `${height}px`, animationDelay: `${index * 120}ms` }}
            />
          ))}
        </span>

        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {formatDuration(recorder.recordingTime)}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAbort}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <MicOff className="h-4 w-4" aria-hidden="true" />
            Dừng Ghi Âm
          </button>
          <button
            type="button"
            onClick={() => void handleFinish()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cta px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cta-hover"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
            Dừng &amp; Phân Tích
          </button>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-4 py-2.5">
        <Loader2
          className="h-4 w-4 animate-spin text-teal-600"
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-slate-700">
          Đang bóc băng hội thoại &amp; đối chiếu phác đồ...
        </span>
        <span className="ml-auto text-xs text-slate-400">
          Whisper STT + LLM lâm sàng trên AI Gateway
        </span>
      </div>
    );
  }

  if (status === "DRAFT_READY" || status === "APPROVED") {
    return (
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200/80 bg-teal-50 px-4 py-2.5">
        <MicOff className="h-4 w-4 text-teal-700" aria-hidden="true" />
        <span className="text-sm font-semibold text-teal-800">
          🤖 Bệnh án AI đã sẵn sàng — Bác sĩ vui lòng kiểm tra và chỉnh sửa
          trước khi ký duyệt.
        </span>
      </div>
    );
  }

  return null;
}
