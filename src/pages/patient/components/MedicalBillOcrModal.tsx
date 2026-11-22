import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Loader2,
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

export interface MedicalBillOcrResult {
  clinicalSummary: string;
  detectedMedications: string[];
  allergyHints: string[];
}

interface MedicalBillOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmed: (result: MedicalBillOcrResult) => void;
}

interface Review {
  clinicalSummary: string;
  detectedMedications: string;
  allergyHints: string;
}

type ScanStatus = "IDLE" | "SCANNING" | "REVIEW";

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-100";

function listToText(values: string[] | undefined): string {
  return (values ?? []).join("\n");
}

function textToList(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter((part) => {
      if (!part || seen.has(part)) return false;
      seen.add(part);
      return true;
    });
}

function toReview(data: InvoiceOcrResponse["data"]): Review {
  return {
    clinicalSummary:
      data.clinicalSummary ??
      [data.notes, ...(data.items ?? []).map((item) => item.name)]
        .filter(Boolean)
        .join("; "),
    detectedMedications: listToText(data.detectedMedications),
    allergyHints: listToText(data.allergyHints),
  };
}

export default function MedicalBillOcrModal({
  isOpen,
  onClose,
  onConfirmed,
}: MedicalBillOcrModalProps) {
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
        const response = await scanInvoiceOcrApi(file, "PATIENT_MEDICAL");
        setResult(response);
        setReview(toReview(response.data));
        setStatus("REVIEW");
      } catch (error) {
        releasePreview();
        setStatus("IDLE");
        toast.error("Không đọc được hóa đơn / biên lai.", {
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
      toast.error("Vui lòng chọn tệp ảnh hóa đơn (.jpg, .png, .webp).");
      return;
    }
    void scan(file);
  }

  function handleConfirm() {
    if (!review || status !== "REVIEW") return;
    const clinicalSummary = review.clinicalSummary.trim();
    const detectedMedications = textToList(review.detectedMedications);
    const allergyHints = textToList(review.allergyHints);

    if (!clinicalSummary && detectedMedications.length === 0 && allergyHints.length === 0) {
      setReviewError(
        "Vui lòng giữ lại ít nhất một thông tin đã chỉnh sửa trước khi xác nhận.",
      );
      return;
    }

    setReviewError(null);
    onConfirmed({ clinicalSummary, detectedMedications, allergyHints });
    reset();
    onClose();
  }

  if (!isOpen) return null;

  const image = result?.image_preview || previewUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4">
      <div className="mx-3 max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-elevated sm:mx-auto sm:max-w-4xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-clinical-50 text-clinical-600">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Quét hóa đơn khám chữa bệnh cũ
              </h2>
              <p className="text-[11px] text-slate-500">
                AI gợi ý - bạn kiểm tra và xác nhận trước khi dùng cho lần khám này.
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
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
                  ? "border-clinical-500 bg-clinical-50"
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
                className="mx-auto h-10 w-10 text-clinical-500"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-semibold text-slate-800">
                Chụp hoặc kéo thả ảnh hóa đơn viện phí / biên lai thuốc cũ
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Thông tin chỉ được dùng sau khi bạn bấm xác nhận bên dưới.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-clinical-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-clinical-700"
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
              <Loader2 className="h-7 w-7 animate-spin text-clinical-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">
                Đang bóc tách thông tin y khoa...
              </p>
            </div>
          )}

          {status === "REVIEW" && result && review && (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-clinical-200 bg-clinical-50 px-3 py-2 text-xs text-clinical-800">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  So với ảnh gốc, hãy sửa các thông tin chưa đúng. Chỉ nội dung bạn
                  xác nhận mới được thêm vào hồ sơ và phiếu khám.
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

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                {image && (
                  <img
                    src={image}
                    alt="Ảnh chứng từ dùng để đối chiếu"
                    className="w-full rounded-lg border border-slate-200 object-contain"
                  />
                )}
                <div className="space-y-3">
                  <ReviewField label="Tóm tắt bệnh sử / chẩn đoán / thuốc đã dùng">
                    <textarea
                      rows={5}
                      className={INPUT_CLASS}
                      value={review.clinicalSummary}
                      onChange={(event) =>
                        setReview((current) =>
                          current
                            ? { ...current, clinicalSummary: event.target.value }
                            : current,
                        )
                      }
                    />
                  </ReviewField>
                  <ReviewField label="Thuốc đã dùng (mỗi dòng một thuốc)">
                    <textarea
                      rows={4}
                      className={INPUT_CLASS}
                      value={review.detectedMedications}
                      onChange={(event) =>
                        setReview((current) =>
                          current
                            ? { ...current, detectedMedications: event.target.value }
                            : current,
                        )
                      }
                    />
                  </ReviewField>
                  <ReviewField label="Gợi ý dị ứng / chống chỉ định (mỗi dòng một ý)">
                    <textarea
                      rows={3}
                      className={INPUT_CLASS}
                      value={review.allergyHints}
                      onChange={(event) =>
                        setReview((current) =>
                          current
                            ? { ...current, allergyHints: event.target.value }
                            : current,
                        )
                      }
                    />
                  </ReviewField>
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
                  onClick={handleConfirm}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-clinical-600 px-5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-clinical-700"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Xác nhận &amp; dùng thông tin này
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
