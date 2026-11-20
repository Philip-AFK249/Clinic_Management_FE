import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Plus,
  ScanLine,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../context/useAuth";
import { useDrugCatalog } from "../../../hooks/useDrugCatalog";
import {
  batchRestockFromInvoiceApi,
  type BatchRestockInvoicePayload,
  type DrugDto,
} from "../../../services/clinicalApi";
import {
  BhytOcrError,
  scanInvoiceOcrApi,
  toIsoDate,
  type InvoiceOcrData,
  type InvoiceOcrResponse,
} from "../../../services/ocrApi";

interface InvoiceRestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestocked?: () => void | Promise<void>;
}

interface RestockLine {
  key: string;
  ocrDrugName: string;
  drugId: number | null;
  drugQuery: string;
  batchNumber: string;
  expiryDate: string;
  quantityAdded: string;
  importUnitPrice: string;
  updateCatalogPrice: boolean;
}

interface RestockReview {
  invoiceNumber: string;
  supplierName: string;
  invoiceDate: string;
  totalAmount: string;
  notes: string;
  items: RestockLine[];
}

type ScanStatus = "IDLE" | "SCANNING" | "REVIEW" | "SUBMITTING";

const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-900 transition-colors focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-100";

function emptyLine(index: number): RestockLine {
  return {
    key: `line-${Date.now()}-${index}`,
    ocrDrugName: "",
    drugId: null,
    drugQuery: "",
    batchNumber: "",
    expiryDate: "",
    quantityAdded: "1",
    importUnitPrice: "",
    updateCatalogPrice: false,
  };
}

function toReview(data: InvoiceOcrData): RestockReview {
  const items = data.items.map((item, index) => ({
    key: `ocr-${Date.now()}-${index}`,
    ocrDrugName: item.name ?? "",
    drugId: null,
    drugQuery: item.name ?? "",
    batchNumber: item.batchNumber ?? "",
    expiryDate: toIsoDate(item.expiryDateIso) || toIsoDate(item.expiryDate),
    quantityAdded: item.quantity != null ? String(item.quantity) : "",
    importUnitPrice: item.unitPrice != null ? String(item.unitPrice) : "",
    updateCatalogPrice: false,
  }));

  return {
    invoiceNumber: data.invoiceNumber ?? "",
    supplierName: data.issuerName ?? "",
    invoiceDate: toIsoDate(data.invoiceDateIso) || toIsoDate(data.invoiceDate),
    totalAmount: data.totalAmount != null ? String(data.totalAmount) : "",
    notes: data.notes ?? "",
    items: items.length > 0 ? items : [emptyLine(0)],
  };
}

function amountOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/[.,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function quantityOrNull(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) ? parsed : null;
}

function drugLabel(drug: DrugDto): string {
  return `${drug.code} — ${drug.name}${drug.concentration ? ` (${drug.concentration})` : ""}`;
}

export default function InvoiceRestockModal({
  isOpen,
  onClose,
  onRestocked,
}: InvoiceRestockModalProps) {
  const { user } = useAuth();
  const catalog = useDrugCatalog();
  const [status, setStatus] = useState<ScanStatus>("IDLE");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<InvoiceOcrResponse | null>(null);
  const [review, setReview] = useState<RestockReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
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
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setStatus("SCANNING");
      setReviewError(null);
      setResult(null);
      setReview(null);

      try {
        const response = await scanInvoiceOcrApi(file, "SUPPLIER_DRUG");
        setResult(response);
        setReview(toReview(response.data));
        setStatus("REVIEW");
      } catch (error) {
        releasePreview();
        setStatus("IDLE");
        toast.error("Không bóc tách được hóa đơn nhập kho.", {
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

  function updateHeader<K extends keyof Omit<RestockReview, "items">>(
    field: K,
    value: RestockReview[K],
  ) {
    setReview((current) => (current ? { ...current, [field]: value } : current));
    setReviewError(null);
  }

  function updateItem(index: number, patch: Partial<RestockLine>) {
    setReview((current) => {
      if (!current) return current;
      const items = [...current.items];
      items[index] = { ...items[index], ...patch };
      return { ...current, items };
    });
    setReviewError(null);
  }

  function addItem() {
    setReview((current) =>
      current
        ? { ...current, items: [...current.items, emptyLine(current.items.length)] }
        : current,
    );
  }

  function removeItem(index: number) {
    setReview((current) => {
      if (!current || current.items.length <= 1) return current;
      return { ...current, items: current.items.filter((_, i) => i !== index) };
    });
  }

  async function handleConfirm() {
    if (!review || status !== "REVIEW") return;

    if (!review.invoiceNumber.trim()) {
      setReviewError("Vui lòng nhập số hóa đơn.");
      return;
    }
    if (!review.supplierName.trim()) {
      setReviewError("Vui lòng nhập tên nhà cung cấp.");
      return;
    }
    if (!user?.fullName?.trim()) {
      setReviewError("Không xác định được người xác nhận nhập kho.");
      return;
    }
    if (review.items.length === 0) {
      setReviewError("Hóa đơn phải có ít nhất một dòng thuốc.");
      return;
    }

    for (const [index, item] of review.items.entries()) {
      if (!item.drugId) {
        setReviewError(`Dòng ${index + 1}: vui lòng chọn thuốc trong kho.`);
        return;
      }
      const quantity = quantityOrNull(item.quantityAdded);
      if (quantity === null || quantity < 1) {
        setReviewError(`Dòng ${index + 1}: số lượng nhập phải là số nguyên tối thiểu 1.`);
        return;
      }
      const price = amountOrNull(item.importUnitPrice);
      if (item.importUnitPrice.trim() && (price === null || price < 0)) {
        setReviewError(`Dòng ${index + 1}: đơn giá nhập không hợp lệ.`);
        return;
      }
    }

    const payload: BatchRestockInvoicePayload = {
      invoiceNumber: review.invoiceNumber.trim(),
      supplierName: review.supplierName.trim(),
      invoiceDate: review.invoiceDate || null,
      totalAmount: amountOrNull(review.totalAmount),
      verifiedBy: user.fullName.trim(),
      notes: review.notes.trim() || null,
      items: review.items.map((item) => ({
        drugId: item.drugId as number,
        ocrDrugName: item.ocrDrugName.trim() || null,
        batchNumber: item.batchNumber.trim() || null,
        expiryDate: item.expiryDate || null,
        quantityAdded: quantityOrNull(item.quantityAdded) as number,
        importUnitPrice: amountOrNull(item.importUnitPrice),
        updateCatalogPrice: item.updateCatalogPrice,
      })),
    };

    setStatus("SUBMITTING");
    setReviewError(null);
    try {
      const saved = await batchRestockFromInvoiceApi(payload);
      toast.success(
        `Đã nhập kho hóa đơn ${saved.invoiceNumber} (${saved.items.length} dòng thuốc).`,
      );
      catalog.refresh();
      await onRestocked?.();
      reset();
      onClose();
    } catch (error) {
      setStatus("REVIEW");
      setReviewError(
        error instanceof Error ? error.message : "Không thể lưu phiếu nhập kho.",
      );
    }
  }

  if (!isOpen) return null;

  const image = result?.image_preview || previewUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-elevated">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <ScanLine className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Quét hóa đơn nhập kho
              </h2>
              <p className="text-[11px] text-slate-500">
                AI bóc tách - bạn đối chiếu và xác nhận trước khi cập nhật tồn kho.
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
                Chụp hoặc kéo thả ảnh hóa đơn nhà cung cấp vào đây
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Hỗ trợ JPG, PNG, WEBP. Hóa đơn cần rõ số lô, hạn dùng và đơn giá.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-clinical-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-clinical-700"
              >
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                Chọn ảnh hóa đơn
              </button>
            </div>
          )}

          {status === "SCANNING" && (
            <div className="flex flex-col items-center gap-3 py-14">
              {image && (
                <img
                  src={image}
                  alt="Ảnh hóa đơn đang quét"
                  className="max-h-56 rounded-lg border border-slate-200 object-contain"
                />
              )}
              <Loader2 className="h-7 w-7 animate-spin text-clinical-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">
                Đang bóc tách hóa đơn bằng AI...
              </p>
            </div>
          )}

          {status === "REVIEW" || status === "SUBMITTING" ? (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-clinical-200 bg-clinical-50 px-3 py-2 text-xs text-clinical-800">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Đối chiếu ảnh gốc với các giá trị bên dưới. Chỉ khi bạn bấm xác
                  nhận, tồn kho mới được cập nhật và mã thuốc/đơn giá được lưu.
                </span>
              </div>

              {(result?.warnings ?? []).length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    Cảnh báo từ AI
                  </p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-amber-700">
                    {result?.warnings?.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {catalog.isUnavailable && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Không tải được danh mục thuốc: {catalog.error}. Vui lòng thử lại
                  trước khi đối chiếu dòng hàng.
                </p>
              )}

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div className="space-y-3">
                  {image && (
                    <img
                      src={image}
                      alt="Ảnh hóa đơn dùng để đối chiếu"
                      className="w-full rounded-lg border border-slate-200 object-contain"
                    />
                  )}
                  {review && (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <Field label="Số hóa đơn">
                        <input
                          className={INPUT_CLASS}
                          value={review.invoiceNumber}
                          onChange={(event) =>
                            updateHeader("invoiceNumber", event.target.value)
                          }
                          disabled={status === "SUBMITTING"}
                        />
                      </Field>
                      <Field label="Nhà cung cấp">
                        <input
                          className={INPUT_CLASS}
                          value={review.supplierName}
                          onChange={(event) =>
                            updateHeader("supplierName", event.target.value)
                          }
                          disabled={status === "SUBMITTING"}
                        />
                      </Field>
                      <Field label="Ngày hóa đơn">
                        <input
                          type="date"
                          className={INPUT_CLASS}
                          value={review.invoiceDate}
                          onChange={(event) =>
                            updateHeader("invoiceDate", event.target.value)
                          }
                          disabled={status === "SUBMITTING"}
                        />
                      </Field>
                      <Field label="Tổng tiền (VNĐ)">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          className={INPUT_CLASS}
                          value={review.totalAmount}
                          onChange={(event) =>
                            updateHeader("totalAmount", event.target.value)
                          }
                          disabled={status === "SUBMITTING"}
                        />
                      </Field>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Ghi chú
                        </span>
                        <textarea
                          rows={2}
                          className={`${INPUT_CLASS} h-auto py-2`}
                          value={review.notes}
                          onChange={(event) =>
                            updateHeader("notes", event.target.value)
                          }
                          disabled={status === "SUBMITTING"}
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  {review && (
                    <>
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full min-w-[900px] border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold text-slate-500">
                              <th className="px-2 py-2">Thuốc trong kho</th>
                              <th className="px-2 py-2">Tên AI đọc được</th>
                              <th className="px-2 py-2">Số lô</th>
                              <th className="px-2 py-2">Hạn dùng</th>
                              <th className="px-2 py-2 text-right">SL nhập</th>
                              <th className="px-2 py-2 text-right">Đơn giá nhập</th>
                              <th className="px-2 py-2">Cập nhật giá</th>
                              <th className="px-2 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {review.items.map((item, index) => (
                              <tr key={item.key} className="align-top">
                                <td className="px-2 py-2">
                                  <div className="relative">
                                    <Search
                                      className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-slate-400"
                                      aria-hidden="true"
                                    />
                                    <input
                                      className={`${INPUT_CLASS} pl-7`}
                                      placeholder="Mã hoặc tên thuốc..."
                                      value={item.drugQuery}
                                      onChange={(event) => {
                                        const query = event.target.value;
                                        const exact = catalog.drugs.find(
                                          (drug) => drugLabel(drug) === query,
                                        );
                                        updateItem(index, {
                                          drugQuery: query,
                                          drugId: exact?.id ?? null,
                                        });
                                      }}
                                      disabled={status === "SUBMITTING"}
                                    />
                                    {item.drugQuery.trim() && !item.drugId && (
                                      <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-elevated">
                                        {catalog.drugs
                                          .filter((drug) => {
                                            const query = item.drugQuery
                                              .trim()
                                              .toLowerCase();
                                            return (
                                              drug.name.toLowerCase().includes(query) ||
                                              drug.code.toLowerCase().includes(query)
                                            );
                                          })
                                          .slice(0, 8)
                                          .map((drug) => (
                                            <button
                                              key={drug.id}
                                              type="button"
                                              onClick={() =>
                                                updateItem(index, {
                                                  drugId: drug.id,
                                                  drugQuery: drugLabel(drug),
                                                })
                                              }
                                              className="block w-full px-2 py-1.5 text-left text-[11px] text-slate-700 transition-colors hover:bg-clinical-50"
                                            >
                                              {drugLabel(drug)}
                                            </button>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                  {item.drugId && (
                                    <p className="mt-1 text-[10px] font-semibold text-emerald-700">
                                      {catalog.byId.get(item.drugId)?.code}
                                    </p>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-[11px] text-slate-500">
                                  {item.ocrDrugName || "—"}
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    className={INPUT_CLASS}
                                    value={item.batchNumber}
                                    onChange={(event) =>
                                      updateItem(index, {
                                        batchNumber: event.target.value,
                                      })
                                    }
                                    disabled={status === "SUBMITTING"}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="date"
                                    className={INPUT_CLASS}
                                    value={item.expiryDate}
                                    onChange={(event) =>
                                      updateItem(index, {
                                        expiryDate: event.target.value,
                                      })
                                    }
                                    disabled={status === "SUBMITTING"}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className={`${INPUT_CLASS} text-right`}
                                    value={item.quantityAdded}
                                    onChange={(event) =>
                                      updateItem(index, {
                                        quantityAdded: event.target.value,
                                      })
                                    }
                                    disabled={status === "SUBMITTING"}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="100"
                                    className={`${INPUT_CLASS} text-right`}
                                    value={item.importUnitPrice}
                                    placeholder="Giữ giá cũ"
                                    onChange={(event) =>
                                      updateItem(index, {
                                        importUnitPrice: event.target.value,
                                      })
                                    }
                                    disabled={status === "SUBMITTING"}
                                  />
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={item.updateCatalogPrice}
                                    onChange={(event) =>
                                      updateItem(index, {
                                        updateCatalogPrice: event.target.checked,
                                      })
                                    }
                                    disabled={status === "SUBMITTING"}
                                    aria-label={`Cập nhật giá thuốc dòng ${index + 1}`}
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <button
                                    type="button"
                                    onClick={() => removeItem(index)}
                                    disabled={
                                      status === "SUBMITTING" ||
                                      review.items.length <= 1
                                    }
                                    aria-label={`Xóa dòng ${index + 1}`}
                                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        type="button"
                        onClick={addItem}
                        disabled={status === "SUBMITTING"}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-clinical-400 hover:text-clinical-700"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Thêm dòng thuốc
                      </button>
                    </>
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
                  disabled={status === "SUBMITTING"}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Quét lại
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={status === "SUBMITTING"}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  {status === "SUBMITTING" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {status === "SUBMITTING"
                    ? "Đang nhập kho..."
                    : "Xác nhận & nhập kho"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
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
