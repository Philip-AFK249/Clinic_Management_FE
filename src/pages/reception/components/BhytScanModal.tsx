import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ImagePlus,
  Loader2,
  ScanLine,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import {
  BhytOcrError,
  bhytInsuranceCodeError,
  fromBhytReview,
  isBhytCardExpired,
  toBhytReview,
  uploadBhytCardApi,
} from "../../../services/ocrApi";
import type {
  BhytOcrData,
  BhytOcrResponse,
  BhytReviewValues,
} from "../../../services/ocrApi";
import { BHYT_INITIAL_HOSPITALS } from "../../patient/data/patientProfile";

interface BhytScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Hands the extracted payload to the parent, which folds it into the form. */
  onApply: (data: BhytOcrData) => void;
}

const DROPZONE_CLASS =
  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-10 text-center transition-colors hover:border-teal-400 hover:bg-teal-50/40";

/**
 * Interactive BHYT card OCR scanner for the reception desk.
 *
 * The secretary drops (or picks) a photo of the card, runs the AI extraction
 * against the gateway (`POST /api/v1/ocr/bhyt`), reviews the parsed fields in a
 * structured preview, and confirms to fold them into the intake form.
 */
export default function BhytScanModal({
  isOpen,
  onClose,
  onApply,
}: BhytScanModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<BhytOcrResponse | null>(null);
  const [review, setReview] = useState<BhytReviewValues | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [expiredAcknowledged, setExpiredAcknowledged] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

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

  const handleFile = useCallback(
    (picked: File) => {
      if (!picked.type.startsWith("image/")) {
        toast.error("Vui lòng chọn tệp ảnh (JPG, PNG hoặc WebP).");
        return;
      }
      setFile(picked);
      setPreview(URL.createObjectURL(picked));
      setResult(null);
      setReview(null);
      setReviewError(null);
      setExpiredAcknowledged(false);
      setScanError(null);
    },
    [setPreview],
  );

  const handleScan = useCallback(async () => {
    if (!file) return;
    setIsScanning(true);
    setScanError(null);
    setReviewError(null);
    setExpiredAcknowledged(false);
    try {
      const response = await uploadBhytCardApi(file);
      if (!mountedRef.current) return;
      setResult(response);
      // Show the editable review form; nothing is applied until the secretary
      // explicitly confirms it below.
      setReview(toBhytReview(response.data));
    } catch (error) {
      if (!mountedRef.current) return;
      const message =
        error instanceof BhytOcrError
          ? error.message
          : "Không thể đọc thẻ. Vui lòng thử ảnh khác.";
      setScanError(message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setIsScanning(false);
    }
  }, [file]);

  function handleReset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setReview(null);
    setReviewError(null);
    setExpiredAcknowledged(false);
    setScanError(null);
  }

  function handleApply() {
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
        "Thẻ BHYT đã hết hạn. Vui lòng đánh dấu xác nhận trước khi áp dụng.",
      );
      return;
    }

    setReviewError(null);
    onApply(fromBhytReview(result.data, review));
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Quét thẻ BHYT bằng AI"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50">
              <ScanLine size={16} className="text-teal-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Quét Thẻ BHYT Bằng AI
              </h3>
              <p className="text-xs text-slate-500">
                Tải ảnh mặt thẻ để bóc tách thông tin tự động
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isScanning}
            aria-label="Đóng cửa sổ quét thẻ"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              // Reset so re-picking the same file still fires a change event.
              event.target.value = "";
              if (picked) handleFile(picked);
            }}
          />

          {!previewUrl ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="Chọn ảnh thẻ BHYT"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const dropped = event.dataTransfer.files?.[0];
                if (dropped) handleFile(dropped);
              }}
              className={cn(
                DROPZONE_CLASS,
                isDragging && "border-teal-500 bg-teal-50",
              )}
            >
              <ImagePlus className="h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">
                Kéo ảnh thẻ vào đây hoặc nhấp để chọn tệp
              </p>
              <p className="text-xs text-slate-500">
                Định dạng JPG, PNG, WebP - ảnh rõ nét, đủ 4 góc thẻ
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 p-2">
                <img
                  src={previewUrl}
                  alt="Ảnh thẻ BHYT tải lên"
                  className="mx-auto max-h-56 w-auto rounded-lg object-contain"
                />
                {isScanning && (
                  <span
                    className="absolute inset-x-0 h-1 bg-emerald-400 shadow-[0_0_14px_3px_rgba(16,185,129,0.9)] animate-laser-scan"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-slate-600">
                  {file?.name}
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isScanning}
                  className="shrink-0 text-xs font-semibold text-teal-600 underline underline-offset-2 transition-colors hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Chọn ảnh khác
                </button>
              </div>
            </div>
          )}

          {scanError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              <TriangleAlert
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              {scanError}
            </div>
          )}

          {result && review && (
            <ScanReview
              response={result}
              review={review}
              fallbackImage={previewUrl}
              expiredAcknowledged={expiredAcknowledged}
              onReviewChange={(patch) => {
                setReview((current) => (current ? { ...current, ...patch } : current));
                setReviewError(null);
              }}
              onExpiredAcknowledgedChange={setExpiredAcknowledged}
            />
          )}

          {reviewError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
            >
              {reviewError}
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleScan()}
            disabled={!file || isScanning}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ScanLine className="h-4 w-4" aria-hidden="true" />
            )}
            {isScanning ? "Đang bóc tách..." : "Bóc tách bằng AI"}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!result || !review || isScanning}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Xác nhận &amp; áp dụng vào form
          </button>
        </div>
      </div>
    </div>
  );
}

const REVIEW_INPUT_CLASS =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100";

const GENDER_REVIEW_OPTIONS = ["Nam", "Nữ", "Khác"];

function ScanReview({
  response,
  review,
  fallbackImage,
  expiredAcknowledged,
  onReviewChange,
  onExpiredAcknowledgedChange,
}: {
  response: BhytOcrResponse;
  review: BhytReviewValues;
  fallbackImage: string | null;
  expiredAcknowledged: boolean;
  onReviewChange: (patch: Partial<BhytReviewValues>) => void;
  onExpiredAcknowledgedChange: (value: boolean) => void;
}) {
  const data = response.data;
  const warnings = response.warnings ?? [];
  const isExpired = isBhytCardExpired(data, review);
  const image = response.image_preview || fallbackImage;
  const note = typeof data.ghi_chu === "string" ? data.ghi_chu.trim() : "";
  const hasUnknownHospital =
    review.initialHospitalCode.length > 0 &&
    !BHYT_INITIAL_HOSPITALS.some(
      (option) => option.code === review.initialHospitalCode,
    );

  function changeHospital(code: string) {
    const known = BHYT_INITIAL_HOSPITALS.find((option) => option.code === code);
    const name = known
      ? known.label
          .replace(/^\s*\d{2}-\d{3}\s*-\s*/, "")
          .replace(/\s*\((?:Đúng|Trái) tuyến[^)]*\)/i, "")
          .trim()
      : code === review.initialHospitalCode
        ? review.initialHospitalName
        : "";
    onReviewChange({ initialHospitalCode: code, initialHospitalName: name });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Vui lòng kiểm tra và sửa lại các trường bên dưới so với ảnh thẻ. Dữ
          liệu chỉ được áp dụng vào form khi bạn bấm nút xác nhận.
        </span>
      </div>

      {isExpired && (
        <div
          role="alert"
          className="rounded-lg border-2 border-red-300 bg-red-50 px-3 py-3 text-red-800"
        >
          <p className="flex items-center gap-2 text-sm font-bold">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            THẺ BHYT ĐÃ HẾT HẠN
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            Thẻ không còn giá trị sử dụng theo dữ liệu OCR. Kiểm tra lại thời
            hạn trên ảnh thẻ trước khi tiếp nhận.
          </p>
          <label className="mt-2 flex items-start gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={expiredAcknowledged}
              onChange={(event) =>
                onExpiredAcknowledgedChange(event.target.checked)
              }
              className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-200"
            />
            Tôi đã kiểm tra và xác nhận tiếp nhận với thẻ đã hết hạn.
          </label>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Cảnh báo từ AI
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-amber-700">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-2">
          {image ? (
            <img
              src={image}
              alt="Ảnh thẻ BHYT dùng để đối chiếu"
              className="w-full rounded-lg border border-slate-200 object-contain"
            />
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
              Không có ảnh xem trước từ máy chủ.
            </p>
          )}
          {note && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-700">Ghi chú: </span>
              {note}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <ReviewField label="Họ và tên">
            <input
              type="text"
              value={review.fullName}
              onChange={(event) =>
                onReviewChange({ fullName: event.target.value })
              }
              className={REVIEW_INPUT_CLASS}
            />
          </ReviewField>

          <ReviewField label="Mã số thẻ BHYT (15 ký tự)">
            <input
              type="text"
              value={review.insuranceCode}
              onChange={(event) =>
                onReviewChange({ insuranceCode: event.target.value })
              }
              className={cn(REVIEW_INPUT_CLASS, "font-mono uppercase")}
            />
          </ReviewField>

          <div className="grid grid-cols-2 gap-2">
            <ReviewField label="Ngày sinh">
              <input
                type="date"
                value={review.dateOfBirth}
                onChange={(event) =>
                  onReviewChange({ dateOfBirth: event.target.value })
                }
                className={REVIEW_INPUT_CLASS}
              />
            </ReviewField>

            <ReviewField label="Giới tính">
              <select
                value={review.gender}
                onChange={(event) =>
                  onReviewChange({ gender: event.target.value })
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
              onChange={(event) => changeHospital(event.target.value)}
              className={REVIEW_INPUT_CLASS}
            >
              <option value="">-- Chọn cơ sở --</option>
              {BHYT_INITIAL_HOSPITALS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
              {hasUnknownHospital && (
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
                  onReviewChange({ validFrom: event.target.value })
                }
                className={REVIEW_INPUT_CLASS}
              />
            </ReviewField>

            <ReviewField label="Giá trị đến">
              <input
                type="date"
                value={review.validUntil}
                onChange={(event) =>
                  onReviewChange({ validUntil: event.target.value })
                }
                className={REVIEW_INPUT_CLASS}
              />
            </ReviewField>
          </div>
        </div>
      </div>
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
