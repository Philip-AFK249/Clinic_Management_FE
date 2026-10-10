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
import { BhytOcrError, uploadBhytCardApi } from "../../../services/ocrApi";
import type { BhytOcrData, BhytOcrResponse } from "../../../services/ocrApi";

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
      setScanError(null);
    },
    [setPreview],
  );

  const handleScan = useCallback(async () => {
    if (!file) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const response = await uploadBhytCardApi(file);
      if (!mountedRef.current) return;
      setResult(response);
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
    setScanError(null);
  }

  function handleApply() {
    if (!result?.data) return;
    onApply(result.data);
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

          {result && <ScanResultPreview response={result} />}
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
            disabled={!result || isScanning}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Áp dụng vào Form tiếp nhận
          </button>
        </div>
      </div>
    </div>
  );
}

/** Trimmed string, or `null` when the model did not read the field. */
function read(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function ScanResultPreview({ response }: { response: BhytOcrResponse }) {
  const data = response.data;
  const warnings = response.warnings ?? [];

  const fullName = read(data.ho_ten) ?? read(data.fullName);
  const insuranceCode =
    read(data.ma_so_bhyt_formatted) ?? read(data.ma_so_bhyt);
  const dateOfBirth = read(data.ngay_sinh) ?? read(data.ngay_sinh_iso);
  const gender = read(data.gioi_tinh) ?? read(data.gender);
  const hospitalCode = read(data.ma_noi_dkkcb_ban_dau);
  const hospitalName = read(data.noi_kham_chua_benh_ban_dau);
  const hospital =
    read(data.noi_kcb_ban_dau_full) ??
    (hospitalCode && hospitalName
      ? `${hospitalCode} (${hospitalName})`
      : hospitalCode ?? hospitalName);
  const note = read(data.ghi_chu);
  const isExpired = data.con_han === false || data.isExpired === true;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <PreviewCard label="Họ và tên" value={fullName} />
        <PreviewCard label="Mã thẻ BHYT" value={insuranceCode} mono />
        <PreviewCard label="Ngày sinh" value={dateOfBirth} />
        <PreviewCard label="Giới tính" value={gender} />
        <PreviewCard
          label="Nơi KCB ban đầu"
          value={hospital}
          className="sm:col-span-2"
        />
      </div>

      {/* Expiry status */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold",
          isExpired
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800",
        )}
      >
        {isExpired ? (
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        {isExpired
          ? "Thẻ đã hết hạn - kiểm tra kỹ trước khi tiếp nhận"
          : "Thẻ còn hạn sử dụng"}
      </div>

      {note && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-700">Ghi chú: </span>
          {note}
        </p>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Cảnh báo từ AI
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-amber-700">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PreviewCard({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 break-words text-sm font-bold text-slate-900",
          mono && "font-mono",
          !value && "font-normal italic text-slate-400",
        )}
      >
        {value ?? "Không đọc được"}
      </p>
    </div>
  );
}
