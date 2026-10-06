import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Real microphone capture for the voice triage flow.
 *
 * This deliberately does NOT use `window.SpeechRecognition`: that API is absent
 * from Firefox and Safari, and where it exists it streams audio to the browser
 * vendor's own cloud recogniser. Triage needs the *audio itself* - Whisper and
 * the clinical LLM run server-side, so the recording has to reach
 * `POST /api/v1/triage/voice-schedule` as a file. `MediaRecorder` is the only
 * way to get those bytes.
 *
 * The clock is wall time, not chunk count: a patient describing symptoms for 30
 * seconds should see 00:30 whether or not the encoder emitted a chunk in that
 * window.
 */

/**
 * Container formats tried in order, best-first.
 *
 * `audio/webm;codecs=opus` is what the FastAPI/Whisper side decodes best; the
 * Safari-only `audio/mp4` is the reason this cannot be a fixed string.
 */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function extensionForMimeType(mimeType: string): string {
  // Matched on the subtype prefix, not on an exact string: every browser that
  // can actually encode also appends `;codecs=opus`, so an exact lookup would
  // miss the format it just recorded and name the upload `.webm` regardless.
  const subtype = mimeType.split(";")[0].trim().toLowerCase();
  if (subtype === "audio/mp4") return "m4a";
  if (subtype === "audio/ogg") return "ogg";
  return "webm";
}

export interface AudioRecorder {
  isRecording: boolean;
  /** Whole seconds since the recorder started. */
  recordingTime: number;
  /**
   * True while the captured clip is being turned into a triage result.
   *
   * Owned here rather than in the component so that one flag drives the whole
   * card's state machine - idle / recording / processing - and cannot drift out
   * of step with `isRecording`.
   */
  isProcessing: boolean;
  /** A failure the patient can act on, or `null`. */
  error: string | null;
  /** False when the browser has no `MediaRecorder` at all. */
  isSupported: boolean;
  startRecording: () => Promise<void>;
  /** `null` when there was nothing usable to deliver (too short, or cancelled). */
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
  /** Clear `error` / `isProcessing` without touching the mic. */
  reset: () => void;
}

/** Under this, Whisper is being handed an empty room rather than a symptom. */
const MIN_CLIP_BYTES = 1024;

export function useAudioRecorder(): AudioRecorder {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Resolver for the in-flight `stopRecording()`; null while idle. */
  const onStoppedRef = useRef<((blob: Blob | null) => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Kill the microphone.
   *
   * `MediaRecorder.stop()` only flushes the encoder - it does not close the
   * hardware. Every track has to be stopped by hand or the browser keeps the mic
   * indicator lit, which on a shared clinic PC means the next patient cannot
   * start a recording at all.
   */
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    clearTimer();
  }, [clearTimer]);

  // Unmount while the mic is open: close it. Runs on every commit by design, the
  // null checks are what make it cheap.
  useEffect(() => releaseStream, [releaseStream]);

  const startRecording = useCallback(async () => {
    setError(null);
    setRecordingTime(0);
    setIsProcessing(false);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Trình duyệt này không hỗ trợ ghi âm. Vui lòng nhập triệu chứng bằng bàn phím.",
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Denied, no device, or a non-secure origin: all indistinguishable here,
      // and all end with the same advice.
      setError(
        "Không mở được microphone. Vui lòng cấp quyền truy cập micro hoặc nhập triệu chứng bằng bàn phím.",
      );
      return;
    }

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      releaseStream();
      setError("Thiết bị không hỗ trợ định dạng ghi âm. Vui lòng thử lại.");
      return;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      // `dataavailable` fires with empty blobs if the encoder had nothing to
      // emit; keeping those would produce a file that plays as silence.
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const chunks = chunksRef.current;
      chunksRef.current = [];
      const resolve = onStoppedRef.current;
      onStoppedRef.current = null;

      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob =
        chunks.length > 0
          ? new Blob(chunks, { type })
          : new Blob([], { type });
      resolve?.(blob.size >= MIN_CLIP_BYTES ? blob : null);
      setIsProcessing(false);
    };

    recorder.onerror = () => {
      onStoppedRef.current?.(null);
      onStoppedRef.current = null;
      releaseStream();
      setIsRecording(false);
      setIsProcessing(false);
      setError("Ghi âm bị gián đoạn. Vui lòng thử lại.");
    };

    recorder.start(250);
    setIsRecording(true);

    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      setRecordingTime(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
  }, [releaseStream]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return Promise.resolve(null);
    }

    clearTimer();
    setIsRecording(false);

    return new Promise<Blob | null>((resolve) => {
      onStoppedRef.current = resolve;
      // The encoder still has to flush on `stop()`, so the card is busy from here
      // until `onstop` hands the blob over - otherwise it flickers back to idle
      // for a frame in the middle of finalising the file.
      setIsProcessing(true);
      recorder.stop();
      releaseStream();
    });
  }, [clearTimer, releaseStream]);

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current;
    // Resolve a pending stop with nothing, so a caller parked on the promise
    // (the patient hit Cancel while the clip was finalising) is not left hanging.
    onStoppedRef.current?.(null);
    onStoppedRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.stop();
    }
    chunksRef.current = [];
    releaseStream();
    setIsRecording(false);
    setRecordingTime(0);
  }, [releaseStream]);

  const reset = useCallback(() => {
    setError(null);
    setIsProcessing(false);
  }, []);

  return {
    isRecording,
    recordingTime,
    isProcessing,
    error,
    isSupported:
      typeof window !== "undefined" && typeof MediaRecorder !== "undefined",
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  };
}
