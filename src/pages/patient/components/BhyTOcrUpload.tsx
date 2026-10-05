import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BhytOcrError, scanBhytCard } from "../../../services/ocrApi";
import { DEMO_BHYT_CARD } from "../data/patientMockRecords";
import type { BhyTelemetry } from "../data/patientMockRecords";

type ScanStatus = "IDLE" | "SCANNING" | "DONE";

interface BhyTOcrUploadProps {
  onExtracted: (info: BhyTelemetry) => void;
}

const SCANNING_TEXT = "Đang bóc tách thông tin thẻ qua AI...";
const SUCCESS_TEXT =
  "✓ Thẻ BHYT hợp lệ. Đã tự động điền thông tin bệnh nhân.";
const ERROR_TEXT =
  "Không nhận diện được thẻ BHYT. Vui lòng chụp rõ nét hơn hoặc nhập tay!";

/**
 * BHYT card scanner: uploads a card photo to the AI gateway
 * (`POST /api/v1/ocr/bhyt`) and hands the extracted identity to `onExtracted`.
 *
 * Renders three states - idle (pick a photo or open the demo card), scanning
 * (in flight), and done (the reconstructed card plus a rescan link).
 */
export default function BhyTOcrUpload({ onExtracted }: BhyTOcrUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ScanStatus>("IDLE");
  const [card, setCard] = useState<BhyTelemetry | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // A scan outlives the component it was started in (the patient can navigate
  // between steps mid-flight), so remember whether one is still running and let
  // `scan()` ignore a late response that nobody is waiting for any more.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Object URLs are a leak the browser cannot reclaim on its own; revoke the
  // previous one whenever it is replaced and the last one on unmount.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const setPreview = useCallback((url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }, []);

  /**
   * Run a scan and publish the result.
   *
   * `file === null` replays `DEMO_BHYT_CARD` instead of hitting the network, so
   * the autofill path can be exercised without an upload. Any failure is
   * reported as a toast and drops back to idle, which re-enables the picker.
   */
  const scan = useCallback(
    async (file: File | null) => {
      setStatus("SCANNING");
      try {
        const telemetry = file ? await scanBhytCard(file) : DEMO_BHYT_CARD;
        if (!mountedRef.current) return;
        setCard(telemetry);
        setStatus("DONE");
        onExtracted(telemetry);
        toast.success(SUCCESS_TEXT);
      } catch (error) {
        if (!mountedRef.current) return;
        // Drop the failed upload so the picker starts from a clean slate.
        setPreview(null);
        setCard(null);
        setStatus("IDLE");
        console.error("BHYT OCR scan failed:", error);
        // One actionable headline covers every failure mode (rejected upload,
        // unreadable card, gateway down); the gateway's own message rides along
        // as the description when it sent a more specific one (timeout, HTTP
        // status, blurry photo).
        toast.error(ERROR_TEXT, {
          description:
            error instanceof BhytOcrError && error.message
              ? error.message
              : undefined,
        });
      }
    },
    [onExtracted, setPreview],
  );

  function handleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    void scan(file);
  }

  /** "Xem ảnh thẻ mẫu": the demo preset, bound exactly like a real scan. */
  function handleDemoSample() {
    void scan(null);
  }

  function handleRescan() {
    setPreview(null);
    setCard(null);
    setStatus("IDLE");
    inputRef.current?.click();
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-5 text-center transition-colors hover:border-clinical-500">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Quét thẻ BHYT / Đơn thuốc cũ tự động
      </p>

      {/* The file input lives in every state: `Quét lại thẻ khác` reuses it. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so re-picking the same file still fires a change event.
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />

      {status === "SCANNING" ? (
        <div className="mx-auto mt-4 max-w-sm">
          {previewUrl && (
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-card">
              <img
                src={previewUrl}
                alt="Ảnh thẻ BHYT đang quét"
                className="mx-auto max-h-48 w-auto object-contain"
              />
              <span
                aria-hidden="true"
                className="absolute inset-x-0 h-1 rounded-full bg-clinical-400 shadow-[0_0_12px_2px_rgba(14,165,233,0.7)] animate-laser-scan"
              />
            </div>
          )}
          {/* Disabled rather than swapped out: the button the patient pressed
              stays put with its spinner, so the progress reads as "working" on
              the control they are watching instead of appearing elsewhere. */}
          <button
            type="button"
            disabled
            aria-busy="true"
            className="mt-4 inline-flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-clinical-600 px-6 text-base font-semibold text-white opacity-70"
          >
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            {SCANNING_TEXT}
          </button>
        </div>
      ) : status === "DONE" && card ? (
        <div className="mx-auto mt-4 max-w-sm space-y-3">
          {/* The photo the patient just took, so they can confirm it is the
              right card before trusting the fields below. */}
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Ảnh thẻ BHYT đã quét"
              className="mx-auto max-h-32 w-auto rounded-lg border border-slate-200 object-contain shadow-card"
            />
          )}

          <ScannedBhyCard card={card} />

          <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {SUCCESS_TEXT}
          </p>

          <button
            type="button"
            onClick={handleRescan}
            className="text-sm font-medium text-clinical-600 underline underline-offset-2 transition-colors hover:text-clinical-700"
          >
            Quét lại thẻ khác
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-clinical-600 px-6 text-base font-semibold text-white shadow-sm transition-all hover:bg-clinical-700"
          >
            <span aria-hidden="true">📷 🪪</span>
            Chụp / Tải ảnh thẻ BHYT
          </button>
          <button
            type="button"
            onClick={handleDemoSample}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-base font-semibold text-slate-700 shadow-sm transition-colors hover:border-clinical-400 hover:text-clinical-700"
          >
            <Sparkles className="h-4 w-4 text-clinical-600" aria-hidden="true" />
            ✨ Xem ảnh thẻ mẫu
          </button>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-500">
            Chụp hoặc tải ảnh thẻ BHYT Việt Nam hoặc đơn thuốc cũ để tự động điền
            thông tin cá nhân của bạn.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The scanned card, rendered as the green BHYT card it was.
 *
 * A reconstruction rather than the photo, because the point is to confirm the
 * *data* that was read back. Fields the model could not read are dropped
 * entirely (their label would be meaningless without a value) and the ones that
 * did read fall back to a dash so an empty box is never mistaken for a printed
 * blank.
 */
function ScannedBhyCard({ card }: { card: BhyTelemetry }) {
  const address = card.address?.trim();
  const initialClinic = card.initialHospitalCode?.trim() || card.hospital?.trim();
  const validity = card.validityDisplay?.trim();

  return (
    <div className="w-full max-w-md rounded-2xl border border-emerald-600/30 bg-gradient-to-br from-emerald-800 via-teal-800 to-emerald-950 p-5 text-left font-sans text-white shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
            Bảo hiểm xã hội Việt Nam
          </p>
          <p className="text-xs font-bold text-white">THẺ BẢO HIỂM Y TẾ</p>
        </div>
        <span className="rounded bg-white/20 px-2 py-0.5 text-[11px] font-bold">
          BHYT
        </span>
      </div>

      <div className="mt-4 border-t border-white/10 pt-2">
        <p className="text-[10px] font-medium uppercase text-emerald-200">
          Mã số thẻ:
        </p>
        <p className="font-mono text-xl font-bold tracking-widest text-amber-300">
          {card.insuranceCode || "-"}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="col-span-2">
          <dt className="text-[10px] font-medium uppercase text-emerald-200">
            Họ và tên:
          </dt>
          <dd className="font-bold uppercase text-white">{card.fullName || "-"}</dd>
        </div>

        <div>
          <dt className="text-[10px] font-medium uppercase text-emerald-200">
            Ngày sinh:
          </dt>
          <dd className="font-medium text-white">
            {card.dateOfBirthLabel || card.dateOfBirth || "-"}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] font-medium uppercase text-emerald-200">
            Giới tính:
          </dt>
          <dd className="font-medium text-white">{card.gender || "-"}</dd>
        </div>

        {address && (
          <div className="col-span-2">
            <dt className="text-[10px] font-medium uppercase text-emerald-200">
              Địa chỉ:
            </dt>
            <dd className="line-clamp-2 text-[11px] text-white/90">{address}</dd>
          </div>
        )}

        {initialClinic && (
          <div className="col-span-2">
            <dt className="text-[10px] font-medium uppercase text-emerald-200">
              Nơi ĐKKCB ban đầu:
            </dt>
            <dd className="text-[11px] font-medium text-white/90">
              {initialClinic}
            </dd>
          </div>
        )}

        {validity && (
          <div className="col-span-2 flex justify-between gap-3 border-t border-white/10 pt-1 text-[10px] text-emerald-200">
            <dt className="font-medium uppercase">Giá trị sử dụng:</dt>
            <dd className="text-right">{validity}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
