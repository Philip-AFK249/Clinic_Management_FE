import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  PackageSearch,
  RefreshCw,
  ScanLine,
  Search,
} from "lucide-react";
import { getDrugsApi } from "../../../services/clinicalApi";
import type { BhytCoverage, DrugDto } from "../../../services/clinicalApi";
import InvoiceRestockModal from "./InvoiceRestockModal";

interface PharmacyInventoryPanelProps {
  /** Bumped by the page after a handover so the stock list reflects the decrement. */
  refreshToken?: number;
}

type StockFilter = "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

const STOCK_FILTERS: { key: StockFilter; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "IN_STOCK", label: "Còn hàng" },
  { key: "LOW_STOCK", label: "Sắp hết < 100" },
  { key: "OUT_OF_STOCK", label: "Hết hàng = 0" },
];

const BHYT_LABELS: Record<BhytCoverage, string> = {
  BHYT_80: "BHYT 80%",
  BHYT_100: "BHYT 100%",
  SELF_PAY: "Tự túc",
};

function formatMoney(value: number): string {
  return `${value.toLocaleString("vi-VN")} đ`;
}

/** `yyyy-MM-dd` / ISO datetime -> `dd/MM/yyyy`, or `—` when absent. */
function formatExpiry(value: string | null | undefined): string {
  if (!value) return "—";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("vi-VN");
}

function stockTone(stock: number): { label: string; className: string } {
  if (stock <= 0) {
    return {
      label: "Hết hàng",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }
  if (stock < 100) {
    return {
      label: "Sắp hết",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  return {
    label: "Còn hàng",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function matchesFilter(drug: DrugDto, filter: StockFilter): boolean {
  switch (filter) {
    case "IN_STOCK":
      return drug.stockQuantity > 0;
    case "LOW_STOCK":
      return drug.stockQuantity > 0 && drug.stockQuantity < 100;
    case "OUT_OF_STOCK":
      return drug.stockQuantity <= 0;
    case "ALL":
    default:
      return true;
  }
}

export default function PharmacyInventoryPanel({
  refreshToken = 0,
}: PharmacyInventoryPanelProps) {
  const [drugs, setDrugs] = useState<DrugDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("ALL");
  const [reloadToken, setReloadToken] = useState(0);
  const [isRestockOpen, setIsRestockOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    getDrugsApi(controller.signal).then(
      (list) => {
        if (cancelled) return;
        setDrugs(list);
        setError(null);
        setIsLoading(false);
      },
      (cause: unknown) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Không tải được danh mục tồn kho từ PostgreSQL.",
        );
        setIsLoading(false);
      },
    );

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken, refreshToken]);

  const counts = useMemo(
    () => ({
      ALL: drugs.length,
      IN_STOCK: drugs.filter((drug) => drug.stockQuantity > 0).length,
      LOW_STOCK: drugs.filter(
        (drug) => drug.stockQuantity > 0 && drug.stockQuantity < 100,
      ).length,
      OUT_OF_STOCK: drugs.filter((drug) => drug.stockQuantity <= 0).length,
    }),
    [drugs],
  );

  const visibleDrugs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return drugs
      .filter((drug) => matchesFilter(drug, filter))
      .filter((drug) => {
        if (!query) return true;
        return (
          drug.name.toLowerCase().includes(query) ||
          drug.code.toLowerCase().includes(query)
        );
      })
      .sort((left, right) =>
        left.name.localeCompare(right.name, "vi", { sensitivity: "base" }),
      );
  }, [drugs, filter, search]);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-slate-200/80 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <PackageSearch className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Kiểm tra tồn kho
            </h2>
            <p className="text-xs text-slate-500">
              Dữ liệu trực tiếp từ bảng <span className="font-mono">drugs</span> trên
              PostgreSQL - cập nhật sau mỗi lần cấp phát.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              {visibleDrugs.length}/{drugs.length} mặt hàng
            </span>
            <button
              type="button"
              onClick={() => setIsRestockOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
              Quét hóa đơn nhập kho
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setReloadToken((token) => token + 1);
              }}
              disabled={isLoading}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {isLoading ? "Đang tải" : "Làm mới tồn kho"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên thuốc hoặc mã thuốc..."
              aria-label="Tìm thuốc theo tên hoặc mã"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {STOCK_FILTERS.map((option) => {
              const active = filter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFilter(option.key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {option.label}
                  <span
                    className={`rounded-full px-1 text-[10px] font-bold ${
                      active
                        ? "bg-white/25 text-white"
                        : "bg-white text-emerald-700"
                    }`}
                  >
                    {counts[option.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {isLoading && drugs.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Đang tải danh mục tồn kho từ PostgreSQL...
          </p>
        ) : visibleDrugs.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">
            {drugs.length === 0
              ? "Chưa có thuốc nào trong kho."
              : "Không có thuốc nào khớp bộ lọc hiện tại."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
            <table className="w-full min-w-[920px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold text-slate-500">
                  <th className="px-3 py-2">Mã</th>
                  <th className="px-3 py-2">Tên thuốc &amp; nồng độ</th>
                  <th className="px-3 py-2">Dạng bào chế</th>
                  <th className="px-3 py-2">Đơn vị tính</th>
                  <th className="px-3 py-2 text-right">Tồn kho</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2 text-right">Đơn giá</th>
                  <th className="px-3 py-2">BHYT</th>
                  <th className="px-3 py-2">Penicillin</th>
                  <th className="px-3 py-2">Hạn dùng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleDrugs.map((drug) => {
                  const tone = stockTone(drug.stockQuantity);
                  return (
                    <tr
                      key={drug.id}
                      className="transition-colors hover:bg-emerald-50/30"
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] font-semibold text-slate-600">
                        {drug.code}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-900">{drug.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {drug.concentration || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{drug.dosageForm}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {drug.unit || "Viên"}
                      </td>
                      <td
                        className={`whitespace-nowrap px-3 py-2 text-right font-bold ${
                          drug.stockQuantity <= 0
                            ? "text-red-600"
                            : drug.stockQuantity < 100
                              ? "text-amber-600"
                              : "text-emerald-700"
                        }`}
                      >
                        {drug.stockQuantity.toLocaleString("vi-VN")}{" "}
                        {drug.unit || "Viên"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone.className}`}
                        >
                          {tone.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-700">
                        {formatMoney(drug.unitPrice)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="inline-block rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                          {BHYT_LABELS[drug.bhytCoverage] ?? drug.bhytCoverage}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {drug.isPenicillinClass ? (
                          <span className="inline-block rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            Có
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Không</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-600">
                        {formatExpiry(drug.expiryDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InvoiceRestockModal
        isOpen={isRestockOpen}
        onClose={() => setIsRestockOpen(false)}
        onRestocked={() => setReloadToken((token) => token + 1)}
      />
    </main>
  );
}
