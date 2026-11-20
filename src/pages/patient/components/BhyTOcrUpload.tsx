import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import BhyCardPreview from "./BhyCardPreview";
import { toast } from "sonner";
import {
  BhytOcrError,
  bhytInsuranceCodeError,
  fromBhytReview,
  isBhytCardExpired,
  toBhytReview,
  toBhyTelemetry,
  uploadBhytCardApi,
} from "../../../services/ocrApi";
import type {
  BhytOcrData,
  BhytOcrResponse,
  BhytReviewValues,
} from "../../../services/ocrApi";
import { DEMO_BHYT_CARD } from "../data/patientMockRecords";
import type { BhyTelemetry } from "../data/patientMockRecords";
import { BHYT_INITIAL_HOSPITALS } from "../data/patientProfile";

type ScanStatus = "IDLE" | "SCANNING" | "REVIEW" | "DONE";

interface BhyTOcrUploadProps {
  onExtracted: (info: BhyTelemetry) => void;
}

const SCANNING_TEXT = "Đang bóc tách thông tin thẻ qua AI...";
const SUCCESS_TEXT =
  "Đã xác nhận thông tin thẻ và điền vào hồ sơ bệnh nhân.";
const ERROR_TEXT =
  "Không nhận diện được thẻ BHYT. Vui lòng chụp rõ nét hơn hoặc nhập tay!";

const REVIEW_INPUT_CLASS =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-100";

const GENDER_REVIEW_OPTIONS = ["Nam", "Nữ", "Khác"];

function demoOcrData(): BhytOcrData {
  return {
    ho_ten: DEMO_BHYT_CARD.fullName,
    ma_so_bhyt: DEMO_BHYT_CARD.insuranceCode.replace(/[\s-]+/g, ""),
    ma_so_bhyt_formatted: DEMO_BHYT_CARD.insuranceCode,
    ngay_sinh: DEMO_BHYT_CARD.dateOfBirthLabel ?? null,
    ngay_sinh_iso: DEMO_BHYT_CARD.dateOfBirth,
    gioi_tinh: DEMO_BHYT_CARD.gender ?? null,
    dia_chi: DEMO_BHYT_CARD.address ?? null,
    ma_noi_dkkcb_ban_dau: "79-014",
    noi_kham_chua_benh_ban_dau: "BV Đa Khoa Sài Gòn",
    noi_kcb_ban_dau_full: DEMO_BHYT_CARD.initialHospitalCode,
    gia_tri_su_dung_tu: DEMO_BHYT_CARD.validFrom ?? null,
    gia_tri_su_dung_den: DEMO_BHYT_CARD.validUntil ?? null,
    han_su_dung_display: DEMO_BHYT_CARD.validityDisplay ?? null,
    con_han: true,
    ghi_chu: null,
    isExpired: false,
    isOcrVerified: true,
  };
}

/**
 * BHYT card scanner: uploads a card photo to the AI gateway
 * (`POST /api/v1/ocr/bhyt`), then shows an editable review form alongside the
 * returned card image. `onExtracted` is called only after the patient confirms
 * the corrected values - a scan never autofills or saves anything by itself.
 */
export default function BhyTOcrUpload({ onExtracted }: BhyTOcrUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ScanStatus>("IDLE");
  const [result, setResult] = useState<BhytOcrResponse | null>(null);
  const [review, setReview] = useState<BhytReviewValues | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [expiredAcknowledged, setExpiredAcknowledged] = useState(false);
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
      setReviewError(null);
      setExpiredAcknowledged(false);
      setResult(null);
      setReview(null);
      setCard(null);
      try {
        const response = file
          ? await uploadBhytCardApi(file)
          : { success: true, data: demoOcrData(), warnings: [] };
        if (!mountedRef.current) return;
        // Stop at the review step. `onExtracted` is only called from the
        // explicit confirm handler, never as a side effect of scanning.
        setResult(response);
        setReview(toBhytReview(response.data));
        setStatus("REVIEW");
      } catch (error) {
        if (!mountedRef.current) return;
        // Drop the failed upload so the picker starts from a clean slate.
        setPreview(null);
        setCard(null);
        setResult(null);
        setReview(null);
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
    [setPreview],
  );

  function handleFile(file: File) {
    setPreview(URL.createObjectURL(file));
    void scan(file);
  }

  /** "Xem ảnh thẻ mẫu": the demo preset, bound exactly like a real scan. */
  function handleDemoSample() {
    void scan(null);
  }

  function handleReviewChange(patch: Partial<BhytReviewValues>) {
    setReview((current) => (current ? { ...current, ...patch } : current));
    setReviewError(null);
  }

  function handleConfirm() {
    if (!result || !review) return;

    if (!review.fullName.trim()) {
      setReviewError("Vui lòng nhập họ và tên đọc được trên thẻ.");
      return;
    }
    const codeError = bhytInsuranceCodeError(review.insuranceCode);
    if (codeError) {
      setReviewError(codeError);
      return;
    }
    if (isBhytCardExpired(result.data, review) && !expiredAcknowledged) {
      setReviewError(
        "Thẻ BHYT đã hết hạn. Vui lòng đánh dấu xác nhận trước khi điền vào hồ sơ.",
      );
      return;
    }

    const telemetry = toBhyTelemetry(fromBhytReview(result.data, review));
    setReviewError(null);
    setCard(telemetry);
    setStatus("DONE");
    onExtracted(telemetry);
    toast.success(SUCCESS_TEXT);
  }

  function handleRescan() {
    setPreview(null);
    setCard(null);
    setResult(null);
    setReview(null);
    setReviewError(null);
    setExpiredAcknowledged(false);
    setStatus("IDLE");
    inputRef.current?.click();
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-5 text-center transition-colors hover:border-clinical-500">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Quét thẻ BHYT tự động
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
      ) : status === "REVIEW" && result && review ? (
        <div className="mt-4 space-y-3 text-left">
          <div className="flex items-start gap-2 rounded-lg border border-clinical-200 bg-clinical-50 px-3 py-2 text-xs text-clinical-800">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              Vui lòng đối chiếu ảnh thẻ và kiểm tra/sửa các thông tin bên dưới.
              Thông tin chỉ được điền vào hồ sơ sau khi bạn bấm xác nhận.
            </span>
          </div>

          {isBhytCardExpired(result.data, review) && (
            <div
              role="alert"
              className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-3 text-red-800"
            >
              <p className="flex items-center gap-2 text-sm font-bold">
                <TriangleAlert
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                THẺ BHYT ĐÃ HẾT HẠN
              </p>
              <p className="mt-1 text-xs leading-relaxed">
                Thẻ không còn giá trị sử dụng theo dữ liệu OCR. Vui lòng kiểm
                tra thời hạn trên ảnh thẻ trước khi xác nhận.
              </p>
              <label className="mt-2 flex items-start gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={expiredAcknowledged}
                  onChange={(event) =>
                    setExpiredAcknowledged(event.target.checked)
                  }
                  className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-200"
                />
                Tôi đã kiểm tra và xác nhận sử dụng thẻ đã hết hạn.
              </label>
            </div>
          )}

          {(result.warnings ?? []).length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Cảnh báo từ AI
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-amber-700">
                {(result.warnings ?? []).map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div>
              {(result.image_preview || previewUrl) && (
                <img
                  src={result.image_preview || previewUrl || undefined}
                  alt="Ảnh thẻ BHYT dùng để đối chiếu"
                  className="w-full rounded-lg border border-slate-200 object-contain"
                />
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <ReviewField label="Họ và tên">
                <input
                  type="text"
                  value={review.fullName}
                  onChange={(event) =>
                    handleReviewChange({ fullName: event.target.value })
                  }
                  className={REVIEW_INPUT_CLASS}
                />
              </ReviewField>

              <ReviewField label="Mã số thẻ BHYT (15 ký tự)">
                <input
                  type="text"
                  value={review.insuranceCode}
                  onChange={(event) =>
                    handleReviewChange({ insuranceCode: event.target.value })
                  }
                  className={`${REVIEW_INPUT_CLASS} font-mono uppercase`}
                />
              </ReviewField>

              <div className="grid grid-cols-2 gap-2">
                <ReviewField label="Ngày sinh">
                  <input
                    type="date"
                    value={review.dateOfBirth}
                    onChange={(event) =>
                      handleReviewChange({ dateOfBirth: event.target.value })
                    }
                    className={REVIEW_INPUT_CLASS}
                  />
                </ReviewField>

                <ReviewField label="Giới tính">
                  <select
                    value={review.gender}
                    onChange={(event) =>
                      handleReviewChange({ gender: event.target.value })
                    }
                    className={REVIEW_INPUT_CLASS}
                  >
                    <option value="">-- Chọn --</option>
                    {GENDER_REVIEW_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </ReviewField>
              </div>

              <ReviewField label="Nơi KCB ban đầu">
                <select
                  value={review.initialHospitalCode}
                  onChange={(event) => {
                    const code = event.target.value;
                    const known = BHYT_INITIAL_HOSPITALS.find(
                      (option) => option.code === code,
                    );
                    const name = known
                      ? known.label
                          .replace(/^\s*\d{2}-\d{3}\s*-\s*/, "")
                          .replace(
                            /\s*\((?:Đúng|Trái) tuyến[^)]*\)/i,
                            "",
                          )
                          .trim()
                      : code === review.initialHospitalCode
                        ? review.initialHospitalName
                        : "";
                    handleReviewChange({
                      initialHospitalCode: code,
                      initialHospitalName: name,
                    });
                  }}
                  className={REVIEW_INPUT_CLASS}
                >
                  <option value="">-- Chọn cơ sở --</option>
                  {BHYT_INITIAL_HOSPITALS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                  {review.initialHospitalCode &&
                    !BHYT_INITIAL_HOSPITALS.some(
                      (option) => option.code === review.initialHospitalCode,
                    ) && (
                      <option value={review.initialHospitalCode}>
                        {review.initialHospitalCode}
                        {review.initialHospitalName
                          ? ` (${review.initialHospitalName})`
                          : ""}
                      </option>
                    )}
                </select>
              </ReviewField>

              <div className="grid grid-cols-2 gap-2">
                <ReviewField label="Giá trị từ">
                  <input
                    type="date"
                    value={review.validFrom}
                    onChange={(event) =>
                      handleReviewChange({ validFrom: event.target.value })
                    }
                    className={REVIEW_INPUT_CLASS}
                  />
                </ReviewField>

                <ReviewField label="Giá trị đến">
                  <input
                    type="date"
                    value={review.validUntil}
                    onChange={(event) =>
                      handleReviewChange({ validUntil: event.target.value })
                    }
                    className={REVIEW_INPUT_CLASS}
                  />
                </ReviewField>
              </div>
            </div>
          </div>

          {reviewError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
            >
              {reviewError}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-clinical-600 px-6 text-base font-semibold text-white shadow-sm transition-all hover:bg-clinical-700"
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              Xác nhận thông tin &amp; điền vào hồ sơ
            </button>
            <button
              type="button"
              onClick={handleRescan}
              className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:border-clinical-400 hover:text-clinical-700"
            >
              Quét lại
            </button>
          </div>
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

          <BhyCardPreview
            fullName={card.fullName}
            insuranceCode={card.insuranceCode}
            dateOfBirthLabel={card.dateOfBirthLabel}
            gender={card.gender}
            address={card.address}
            hospital={card.initialHospitalCode?.trim() || card.hospital?.trim()}
            validityDisplay={card.validityDisplay?.trim()}
            verified
          />

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
            Chụp hoặc tải ảnh thẻ BHYT Việt Nam để bóc tách thông tin, sau đó
            kiểm tra và xác nhận trước khi điền vào hồ sơ.
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
