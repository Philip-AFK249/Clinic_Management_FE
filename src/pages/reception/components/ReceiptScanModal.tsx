import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  ReceiptText,
  ScanLine,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  BhytOcrError,
  scanInvoiceOcrApi,
  type InvoiceOcrResponse,
} from "../../../services/ocrApi";

export interface ReceiptScanResult {
  receiptNumber: string;
  receiptAmount: number;
}

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: ReceiptScanResult) => void;
}

interface Review {
  receiptNumber: string;
  receiptAmount: string;
  issuerName: string;
}

type ScanStatus = "IDLE" | "SCANNING" | "REVIEW";

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100";

function amountToText(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return Number.isFinite(value) ? String(value) : "";
}

function textToAmount(value: string): number | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function toReview(data: InvoiceOcrResponse["data"]): Review {
  return {
    receiptNumber: data.invoiceNumber?.trim() ?? "",
    receiptAmount: amountToText(data.totalAmount),
    issuerName: data.issuerName?.trim() ?? "",
  };
}

export default function ReceiptScanModal({
  isOpen,
  onClose,
  onApply,
}: ReceiptScanModalProps) {
  const [status, setStatus] = useState<ScanStatus>("IDLE");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<InvoiceOcrResponse | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const releasePreview = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    releasePreview();
    setStatus("IDLE");
    setResult(null);
    setReview(null);
    setReviewError(null);
    setIsDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [releasePreview]);

  const scan = useCallback(
    async (file: File) => {
      releasePreview();
      const url = URL.createObjectURL(file);
      previewRef.current = url;
      setPreviewUrl(url);
      setStatus("SCANNING");
      setReviewError(null);
      setResult(null);
      setReview(null);

      try {
        const response = await scanInvoiceOcrApi(file, "RECEPTION_RECEIPT");
        setResult(response);
        setReview(toReview(response.data));
        setStatus("REVIEW");
      } catch (error) {
        releasePreview();
        setStatus("IDLE");
        toast.error("Không đọc được biên lai / giấy chuyển viện.", {
          description:
            error instanceof BhytOcrError && error.message
              ? error.message
              : error instanceof Error
                ? error.message
                : undefined,
        });
      }
    },
    [releasePreview],
  );

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp ảnh biên lai (.jpg, .png, .webp).");
      return;
    }
    void scan(file);
  }

  function handleApply() {
    if (!review || status !== "REVIEW") return;
    const receiptNumber = review.receiptNumber.trim();
    const receiptAmount = textToAmount(review.receiptAmount);

    if (!receiptNumber) {
      setReviewError("Vui lòng nhập số biên lai / số hóa đơn.");
      return;
    }
    if (receiptAmount === null) {
      setReviewError("Vui lòng nhập số tiền hợp lệ (lớn hơn 0).");
      return;
    }

    setReviewError(null);
    onApply({ receiptNumber, receiptAmount });
    reset();
    onClose();
  }

  if (!isOpen) return null;

  const image = result?.image_preview || previewUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-elevated">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <ReceiptText className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Quét biên lai / giấy chuyển viện
              </h2>
              <p className="text-[11px] text-slate-500">
                AI đề xuất số chứng từ và số tiền - nhân viên đối chiếu trước khi cấp số.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {status === "IDLE" && (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                handleFile(event.dataTransfer.files?.[0]);
              }}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? "border-teal-500 bg-teal-50"
                  : "border-slate-300 bg-slate-50"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              <ScanLine
                className="mx-auto h-10 w-10 text-teal-500"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-semibold text-slate-800">
                Chụp hoặc kéo thả ảnh biên lai / giấy chuyển viện
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Số chứng từ và số tiền sẽ hiện để bạn sửa trước khi đính kèm.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
              >
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                Chọn ảnh chứng từ
              </button>
            </div>
          )}

          {status === "SCANNING" && (
            <div className="flex flex-col items-center gap-3 py-14">
              {image && (
                <img
                  src={image}
                  alt="Ảnh chứng từ đang quét"
                  className="max-h-56 rounded-lg border border-slate-200 object-contain"
                />
              )}
              <Loader2 className="h-7 w-7 animate-spin text-teal-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">
                Đang đọc số biên lai và số tiền...
              </p>
            </div>
          )}

          {status === "REVIEW" && result && review && (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Đối chiếu với ảnh gốc. Chỉ số chứng từ và số tiền bạn xác nhận
                  mới được gắn vào phiếu khám.
                </span>
              </div>

              {(result.warnings ?? []).length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    Cảnh báo từ AI
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-amber-700">
                    {result.warnings?.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {image && (
                  <img
                    src={image}
                    alt="Ảnh chứng từ dùng để đối chiếu"
                    className="w-full rounded-lg border border-slate-200 object-contain"
                  />
                )}
                <div className="space-y-3">
                  <ReviewField label="Số biên lai / số hóa đơn">
                    <input
                      className={INPUT_CLASS}
                      value={review.receiptNumber}
                      onChange={(event) =>
                        setReview((current) =>
                          current
                            ? { ...current, receiptNumber: event.target.value }
                            : current,
                        )
                      }
                    />
                  </ReviewField>
                  <ReviewField label="Số tiền (VNĐ)">
                    <input
                      className={INPUT_CLASS}
                      inputMode="numeric"
                      value={review.receiptAmount}
                      onChange={(event) =>
                        setReview((current) =>
                          current
                            ? { ...current, receiptAmount: event.target.value }
                            : current,
                        )
                      }
                    />
                  </ReviewField>
                  {review.issuerName && (
                    <ReviewField label="Nơi phát hành (để đối chiếu)">
                      <input className={INPUT_CLASS} value={review.issuerName} readOnly />
                    </ReviewField>
                  )}
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

              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    requestAnimationFrame(() => inputRef.current?.click());
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Quét lại
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Xác nhận &amp; đính kèm
                </button>
              </div>
            </>
          )}
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
      <span className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
