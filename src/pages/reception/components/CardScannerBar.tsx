import { useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Keyboard,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import type { IntakeMode } from "../hooks/useIntakeForm";
import { INTAKE_SOURCE_LABELS } from "../data/receptionMockData";
import type { OcrCardSample } from "../data/receptionMockData";
import BhytScanModal from "./BhytScanModal";
import type { BhytOcrData } from "../../../services/ocrApi";

interface CardScannerBarProps {
  mode: IntakeMode;
  isOcrVerified: boolean;
  sample: OcrCardSample | null;
  onModeChange: (mode: IntakeMode) => void;
  /** Hands the AI Gateway payload up so the page can fold it into the form. */
  onApplyOcr: (data: BhytOcrData) => void;
}

export default function CardScannerBar({
  mode,
  isOcrVerified,
  sample,
  onModeChange,
  onApplyOcr,
}: CardScannerBarProps) {
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  function handleApply(data: BhytOcrData) {
    onApplyOcr(data);
    setIsScanModalOpen(false);
  }

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold leading-tight text-slate-900">
              Tiếp Nhận Hành Chính
            </h2>
            <p className="text-[11px] text-slate-500">
              Nguồn: {INTAKE_SOURCE_LABELS[mode === "SCAN" ? "KIOSK_OCR" : "RECEPTION_MANUAL"]}
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div
          role="tablist"
          aria-label="Chế độ nhập thông tin bệnh nhân"
          className="flex overflow-hidden rounded-lg border border-slate-300"
        >
          <ModeTab
            active={mode === "SCAN"}
            icon={<ScanLine className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Quét CCCD / BHYT"
            onClick={() => onModeChange("SCAN")}
          />
          <ModeTab
            active={mode === "MANUAL"}
            icon={<Keyboard className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Nhập tay"
            onClick={() => onModeChange("MANUAL")}
          />
        </div>
      </div>

      {mode === "SCAN" ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 overflow-hidden rounded-lg border border-slate-300 bg-slate-900 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-emerald-300">
                    {(sample?.cardLabel ?? "Sẵn sàng quét thẻ BHYT").toUpperCase()}
                  </p>
                  <p className="truncate font-mono text-[11px] text-emerald-200/80">
                    {sample?.insuranceCode || "Nhấn nút quét để tải ảnh thẻ lên"}
                  </p>
                </div>
                <ScanLine className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsScanModalOpen(true)}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-600 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-700 active:scale-[0.98]"
            >
              <ScanLine className="h-4 w-4" aria-hidden="true" />
              Quét CCCD / BHYT
            </button>
          </div>

          {sample && (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 ${
                isOcrVerified
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              {isOcrVerified ? (
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
              ) : (
                <TriangleAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 text-[11px] leading-relaxed">
                <p
                  className={`font-bold ${
                    isOcrVerified ? "text-emerald-800" : "text-amber-800"
                  }`}
                >
                  {isOcrVerified
                    ? "Thẻ đã được bóc tách bằng AI và áp dụng vào form"
                    : "OCR không đủ tin cậy - cần thủ công kiểm tra"}
                </p>
                <p
                  className={
                    isOcrVerified ? "text-emerald-700" : "text-amber-700"
                  }
                >
                  {sample?.fullName} &middot; {sample?.insuranceCode}
                </p>
              </div>
            </div>
          )}

          {sample && !isOcrVerified && (
            <button
              type="button"
              onClick={() => onModeChange("MANUAL")}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
            >
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Thẻ hết hạn / không đọc được? Chuyển sang nhập tay ngay
            </button>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
          Đang nhập thông tin hành chính bằng tay. Thẻ không có chip, thẻ hết hạn
          hoặc OCR không đọc được? Hãy kiểm tra kỹ mã BHYT và CCCD trước khi cấp
          số.
        </p>
      )}

      <BhytScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onApply={handleApply}
      />
    </section>
  );
}

function ModeTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-1.5 px-3.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-teal-600 text-white"
          : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
