import { useState } from "react";
import {
  Camera,
  CheckCircle2,
  TriangleAlert,
  X,
} from "lucide-react";
import type {
  KioskCardVerification,
  KioskPatient,
} from "../data/kioskMockData";
import { OCR_EXTRACT_SECTIONS } from "../data/kioskMockData";
import {
  bhytInsuranceCodeError,
  normalizeBhytInsuranceCode,
} from "../../../services/ocrApi";

interface KioskCardOcrModalProps {
  patient: KioskPatient;
  onClose: () => void;
  /** Called only after the patient confirms the corrected review values. */
  onComplete: (verification: KioskCardVerification) => void;
}

const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100";

/** Printed `dd/mm/yyyy` to the ISO form used for comparisons. */
function isoFromDmy(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function isCardExpired(validUntil: string): boolean {
  const iso = isoFromDmy(validUntil);
  if (!iso) return false;
  return iso < new Date().toISOString().slice(0, 10);
}

export default function KioskCardOcrModal({
  patient,
  onClose,
  onComplete,
}: KioskCardOcrModalProps) {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [review, setReview] = useState<KioskCardVerification | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [expiredAcknowledged, setExpiredAcknowledged] = useState(false);

  function startScan() {
    setScanning(true);
    setProgress(0);
    setReview(null);
    setReviewError("");
    setExpiredAcknowledged(false);
    let current = 0;
    const interval = window.setInterval(() => {
      current += 20;
      setProgress(current);
      if (current >= 100) {
        window.clearInterval(interval);
        setScanning(false);
        // Stop at an editable review. The kiosk must not advance to triage (or
        // later check-in) until the patient confirms these values.
        setReview({
          fullName: patient.patientName,
          insuranceCode: patient.insuranceSerial,
          dateOfBirth: patient.dob,
          gender: patient.gender,
          initialHospitalCode: patient.initialHospitalCode,
          insuranceValidUntil: patient.insuranceValidUntil,
        });
      }
    }, 360);
  }

  function updateReview(patch: Partial<KioskCardVerification>) {
    setReview((current) => (current ? { ...current, ...patch } : current));
    setReviewError("");
  }

  function confirmReview() {
    if (!review) return;
    if (!review.fullName.trim()) {
      setReviewError("Vui lòng nhập họ và tên đọc được trên thẻ.");
      return;
    }
    const codeError = bhytInsuranceCodeError(review.insuranceCode);
    if (codeError) {
      setReviewError(codeError);
      return;
    }
    if (isCardExpired(review.insuranceValidUntil) && !expiredAcknowledged) {
      setReviewError(
        "Thẻ BHYT đã hết hạn. Vui lòng đánh dấu xác nhận trước khi tiếp tục.",
      );
      return;
    }

    onComplete({
      ...review,
      fullName: review.fullName.trim(),
      insuranceCode: normalizeBhytInsuranceCode(review.insuranceCode),
      initialHospitalCode: review.initialHospitalCode.trim(),
    });
  }

  const expired = review ? isCardExpired(review.insuranceValidUntil) : false;
  const cardCode = review?.insuranceCode || patient.insuranceSerial;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Đóng quét thẻ"
        onClick={scanning ? () => undefined : onClose}
        className="absolute inset-0 bg-slate-900/40"
      />

      <div className="absolute inset-x-0 top-1/2 mx-auto w-full max-w-lg -translate-y-1/2 px-6">
        <div className="max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-surface-light shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-5 py-3">
            <div>
              <p className="text-lg font-bold text-slate-900">
                Đăng Ký Khám Mới - Quét Thẻ BHYT / CCCD
              </p>
              <p className="text-xs text-slate-500">
                Đặt thẻ gắn chip vào khe đọc bên dưới
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ"
              disabled={scanning}
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-5 p-5">
            {/* Card reader bay */}
            <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-slate-300 bg-slate-900 p-6">
              <div className="relative flex items-center justify-center">
                <div className="rounded-lg border border-emerald-300/60 bg-emerald-950/60 px-6 py-8 text-center">
                  <p className="text-sm font-bold text-emerald-300">
                    THẺ BHYT - CHỨNG MINH NHÂN DÂN
                  </p>
                  <p className="mt-1 font-mono text-xs text-emerald-200/80">
                    {cardCode}
                  </p>
                </div>
                {scanning && (
                  <span
                    className="absolute inset-x-0 h-1 bg-emerald-400 shadow-[0_0_14px_3px_rgba(16,185,129,0.9)] animate-laser-scan"
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className="mt-4 flex items-center justify-center gap-1 text-xs text-slate-400">
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                Khe đọc thẻ từ dưới - giữ thẻ cố định
              </p>
            </div>

            {/* OCR telemetry */}
            <div className="space-y-2">
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                🔍 PaddleOCR:{" "}
                {scanning || progress > 0
                  ? "Đang trích xuất Mã thẻ BHYT 15 ký tự, Họ tên, Nơi KCB..."
                  : "Sẵn sàng - đặt thẻ vào khe đọc bên dưới"}
              </p>
              {progress > 0 && (
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>

            {!scanning && review && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-teal-800">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Đã đọc thẻ. Vui lòng kiểm tra và sửa lại thông tin bên dưới
                    trước khi xác nhận.
                  </span>
                </div>

                {expired && (
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
                      Thẻ không còn giá trị sử dụng theo dữ liệu đọc được.
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

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Họ và tên
                    </span>
                    <input
                      type="text"
                      value={review.fullName}
                      onChange={(event) =>
                        updateReview({ fullName: event.target.value })
                      }
                      className={INPUT_CLASS}
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Mã số thẻ BHYT (15 ký tự)
                    </span>
                    <input
                      type="text"
                      value={review.insuranceCode}
                      onChange={(event) =>
                        updateReview({ insuranceCode: event.target.value })
                      }
                      className={`${INPUT_CLASS} font-mono uppercase`}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Ngày sinh (dd/mm/yyyy)
                    </span>
                    <input
                      type="text"
                      value={review.dateOfBirth}
                      onChange={(event) =>
                        updateReview({ dateOfBirth: event.target.value })
                      }
                      className={INPUT_CLASS}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Giới tính
                    </span>
                    <select
                      value={review.gender}
                      onChange={(event) =>
                        updateReview({
                          gender: event.target.value as "Nam" | "Nữ",
                        })
                      }
                      className={INPUT_CLASS}
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Nơi KCB ban đầu
                    </span>
                    <input
                      type="text"
                      value={review.initialHospitalCode}
                      onChange={(event) =>
                        updateReview({
                          initialHospitalCode: event.target.value,
                        })
                      }
                      className={INPUT_CLASS}
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Giá trị sử dụng đến (dd/mm/yyyy)
                    </span>
                    <input
                      type="text"
                      value={review.insuranceValidUntil}
                      onChange={(event) =>
                        updateReview({
                          insuranceValidUntil: event.target.value,
                        })
                      }
                      className={INPUT_CLASS}
                    />
                  </label>
                </div>

                {reviewError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
                  >
                    {reviewError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={confirmReview}
                  className="flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-lg font-bold text-white shadow-md transition-all hover:bg-teal-700 active:scale-95"
                >
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                  Xác nhận &amp; tiếp tục khai báo
                </button>
              </div>
            )}

            {!scanning && !review && (
              <button
                type="button"
                onClick={startScan}
                className="flex h-16 w-full items-center justify-center gap-3 rounded-xl bg-teal-600 text-lg font-bold text-white shadow-md transition-all hover:bg-teal-700 active:scale-95"
              >
                <Camera className="h-6 w-6" aria-hidden="true" />
                📥 Đặt Thẻ BHYT Mẫu Vào Khe Đọc (DN 4 79 79 12345678)
              </button>
            )}
            {scanning && (
              <div className="space-y-1">
                {OCR_EXTRACT_SECTIONS.map((section, index) => (
                  <p
                    key={section}
                    className="flex items-center gap-2 text-xs text-slate-500"
                  >
                    <CheckCircle2
                      className={`h-3.5 w-3.5 ${
                        progress >= (index + 1) * 20
                          ? "text-teal-600"
                          : "text-slate-300"
                      }`}
                      aria-hidden="true"
                    />
                    {section}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
