import { Bell, Camera, Pill, RefreshCw } from "lucide-react";

interface PharmacyHeaderProps {
  pendingCount: number;
  readyCount: number;
  /** Prescriptions dispensed during this counter shift. */
  dispensedCount: number;
  pharmacistName: string;
  pharmacistInitials: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenScanner: () => void;
}

export default function PharmacyHeader({
  pendingCount,
  readyCount,
  dispensedCount,
  pharmacistName,
  pharmacistInitials,
  isRefreshing,
  onRefresh,
  onOpenScanner,
}: PharmacyHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-4">
      {/* Brand & location */}
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Pill className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold leading-tight text-slate-900">
            Smart Clinic{" "}
            <span className="ml-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Quầy Dược Lâm Sàng #1
            </span>
          </p>
          <p className="text-xs text-slate-500">Tầng Trệt</p>
        </div>
      </div>

      {/* Live counters */}
      <div className="hidden items-center gap-6 lg:flex">
        <div className="text-xs font-medium text-slate-600">
          Chờ chuẩn bị:{" "}
          <span className="font-bold text-amber-600">{pendingCount} đơn</span>
        </div>
        <div className="text-xs font-medium text-slate-600">
          Sẵn sàng phát thuốc:{" "}
          <span className="font-bold text-sky-600">{readyCount} đơn</span>
        </div>
        <div className="text-xs font-medium text-slate-600">
          Đã cấp phát ca này:{" "}
          <span className="font-bold text-emerald-700">
            {dispensedCount} toa
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {isRefreshing ? "Đang tải" : "Làm mới"}
        </button>
      </div>

      {/* Scanner action + profile */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenScanner}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          Quét Mã QR Bệnh Nhân
        </button>
        <button
          type="button"
          aria-label="Thông báo"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Bell className="h-4 w-4" />
          <span
            className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"
            aria-hidden="true"
          />
        </button>
        <div className="flex items-center gap-2.5 border-l border-slate-200/80 pl-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
            {pharmacistInitials}
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-900">
              {pharmacistName}
            </p>
            <p className="text-[11px] text-slate-500">
              Dược sĩ phụ trách cấp phát
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
