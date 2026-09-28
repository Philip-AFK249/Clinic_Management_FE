import { Bell, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../context/useAuth";
import PortalSwitcher from "../../../components/PortalSwitcher";
import type { SystemMetrics } from "../data/adminMockData";

interface AdminHeaderProps {
  metrics: SystemMetrics;
}

export default function AdminHeader({ metrics }: AdminHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
          <ShieldCheck size={14} className="text-slate-600" aria-hidden="true" />
          <span className="text-xs font-semibold text-slate-700">
            Quản trị viên Hệ thống
          </span>
        </div>
        <div className="hidden items-center gap-4 text-xs text-slate-500 xl:flex">
          <span>
            Ca đang khám:{" "}
            <span className="font-semibold text-slate-800">{metrics.activeEncounters}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            Hàng đợi:{" "}
            <span className="font-semibold text-slate-800">{metrics.queueDepth}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            OCR:{" "}
            <span className="font-semibold text-emerald-600">{metrics.ocrSuccessRate}%</span>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            AI Latency:{" "}
            <span className="font-semibold text-slate-800">{metrics.avgAiLatencyMs}ms</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <PortalSwitcher />
        <button
          type="button"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Thông báo hệ thống"
        >
          <Bell size={18} />
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cta text-[9px] font-bold text-white">
            3
          </span>
        </button>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
            {user?.fullName?.charAt(0) ?? "A"}
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-xs font-semibold text-slate-800">{user?.fullName}</p>
            <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          aria-label="Đăng xuất"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
