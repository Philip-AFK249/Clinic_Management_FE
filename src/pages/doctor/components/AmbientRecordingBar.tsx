import { Loader2, Mic, MicOff, Plus, RotateCcw, Square, X } from "lucide-react";
import { toast } from "sonner";
import type {
  ConsultationStatus,
  RecordingMode,
  RecordingStartResult,
} from "../hooks/useAmbientConsultation";

interface AmbientRecordingBarProps {
  status: ConsultationStatus;
  /** Which clip the recorder is capturing - drives labels and copy. */
  recordingMode: RecordingMode | null;
  /** Whole seconds since capture started. */
  recordingTime: number;
  /** True while the recorder is still flushing the clip. */
  isProcessing: boolean;
  /** False when the browser has no MediaRecorder at all. */
  isSupported: boolean;
  /** Microphone failure the doctor can act on. */
  error: string | null;
  /** Open the mic for the full consultation recording. */
  onStart: () => Promise<RecordingStartResult>;
  /** Open the mic for a short follow-up that revises the current draft. */
  onStartFollowUp: () => Promise<RecordingStartResult>;
  /** Confirm, discard the current AI summary and record the whole visit again. */
  onReRecord: () => Promise<RecordingStartResult>;
  /** Stop capture and resolve the in-memory clip. */
  onStopRecording: () => Promise<Blob | null>;
  /**
   * The transient in-memory clip is handed over exactly once, then the caller
   * uploads it to the AI Gateway. It is never persisted anywhere.
   */
  onRecordingReady: (audioBlob: Blob) => void;
  /** Abort the active clip without analysing it. */
  onCancelRecording: () => void;
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
  recordingMode,
  recordingTime,
  isProcessing,
  isSupported,
  error,
  onStart,
  onStartFollowUp,
  onReRecord,
  onStopRecording,
  onRecordingReady,
  onCancelRecording,
}: AmbientRecordingBarProps) {
  const isFollowUp = recordingMode === "FOLLOW_UP";
  /**
   * Two things show the processing banner: the recorder still flushing the
   * clip, and the gateway analysing it. Both are the same wait for the doctor.
   */
  const processing = status === "ANALYZING" || isProcessing;

  function reportFailedStart(result: RecordingStartResult) {
    if (result !== "failed") return;
    toast.error(
      error ?? "Không mở được microphone. Vui lòng cấp quyền truy cập micro.",
      { duration: 6000 },
    );
  }

  async function handleStart() {
    reportFailedStart(await onStart());
  }

  async function handleFollowUp() {
    reportFailedStart(await onStartFollowUp());
  }

  async function handleReRecord() {
    // "cancelled" means the doctor declined the confirmation - no error toast.
    reportFailedStart(await onReRecord());
  }

  async function handleFinish() {
    const audioBlob = await onStopRecording();
    if (!audioBlob) {
      toast.error(
        "Chưa có dữ liệu âm thanh để phân tích. Vui lòng nói to hơn và thử lại.",
        { duration: 5000 },
      );
      return;
    }
    onRecordingReady(audioBlob);
  }

  function handleAbort() {
    onCancelRecording();
    toast.info(
      isFollowUp
        ? "Đã hủy ghi âm bổ sung. Bệnh án hiện tại được giữ nguyên."
        : "Đã dừng ghi âm. Phiên phân tích được hủy, hồ sơ chưa thay đổi.",
    );
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
          {error && (
            <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={!isSupported}
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
        <span
          className={`flex items-center gap-2 text-sm font-semibold ${
            isFollowUp ? "text-sky-700" : "text-emerald-700"
          }`}
        >
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${
                isFollowUp ? "bg-sky-400" : "bg-emerald-400"
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                isFollowUp ? "bg-sky-500" : "bg-emerald-500"
              }`}
            />
          </span>
          {isFollowUp ? "ĐANG GHI ÂM BỔ SUNG" : "ĐANG THU ÂM CUỘC KHÁM"}
        </span>

        {/* Pulsating wave */}
        <span className="flex h-8 items-center gap-1" aria-hidden="true">
          {WAVE_BARS.map((height, index) => (
            <span
              key={index}
              className={`w-1.5 animate-pulse rounded-full ${
                isFollowUp ? "bg-sky-500" : "bg-emerald-500"
              }`}
              style={{ height: `${height}px`, animationDelay: `${index * 120}ms` }}
            />
          ))}
        </span>

        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {formatDuration(recordingTime)}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAbort}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleFinish()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cta px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cta-hover"
          >
            <Square className="h-4 w-4" aria-hidden="true" />
            {isFollowUp ? "Dừng & Cập Nhật Bệnh Án" : "Dừng & Phân Tích"}
          </button>
        </div>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-4 py-2.5">
        <Loader2
          className="h-4 w-4 animate-spin text-teal-600"
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-slate-700">
          {isFollowUp
            ? "Đang nghe lại phần bổ sung & cập nhật bệnh án hiện tại..."
            : "Đang bóc băng hội thoại & đối chiếu phác đồ..."}
        </span>
        <span className="ml-auto text-xs text-slate-400">
          Whisper STT + LLM lâm sàng trên AI Gateway
        </span>
      </div>
    );
  }

  if (status === "DRAFT_READY" || status === "APPROVED") {
    const locked = status === "APPROVED";
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200/80 bg-teal-50 px-4 py-2.5">
        <MicOff className="h-4 w-4 text-teal-700" aria-hidden="true" />
        <span className="text-sm font-semibold text-teal-800">
          🤖 Bệnh án AI đã sẵn sàng — Bác sĩ vui lòng kiểm tra và chỉnh sửa
          trước khi ký duyệt.
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleReRecord()}
            disabled={locked}
            title="Hủy bản ghi cũ và thu âm lại từ đầu khi gặp lỗi hoặc tiếng ồn"
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Ghi âm lại từ đầu
          </button>
          <button
            type="button"
            onClick={() => void handleFollowUp()}
            disabled={locked}
            title="Ghi âm thêm triệu chứng hoặc tiền sử phát sinh để AI cập nhật vào bệnh án hiện tại"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mic className="h-3.5 w-3.5" aria-hidden="true" />
            <Plus className="-ml-1 h-3 w-3" aria-hidden="true" />
            Nói bổ sung
          </button>
        </div>
      </div>
    );
  }

  return null;
}
