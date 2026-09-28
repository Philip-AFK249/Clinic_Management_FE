import { ConciergeBell, LogOut, Radio, Users } from "lucide-react";
import { useAuth } from "../../../context/useAuth";
import { ROLE_THEMES } from "../../../config/roleThemes";
import PortalSwitcher from "../../../components/PortalSwitcher";

interface ReceptionHeaderProps {
  waitingCount: number;
  emergencyCount: number;
  isOffline: boolean;
}

export default function ReceptionHeader({
  waitingCount,
  emergencyCount,
  isOffline,
}: ReceptionHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-4">
      {/* Brand */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
          <ConciergeBell className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-slate-900">
            Smart Clinic{" "}
            <span className="ml-1 rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
              Quầy Tiếp Đón
            </span>
          </p>
          <p className="truncate text-xs text-slate-500">
            Y tái tiếp đón / Thư ký y khoa &middot; Sảnh A - Tầng 1
          </p>
        </div>
      </div>

      {/* Queue metrics */}
      <div className="hidden items-center gap-5 lg:flex">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-teal-600" aria-hidden="true" />
          <span className="text-xs font-medium text-slate-600">
            Đang chờ:{" "}
            <span className="font-bold text-slate-900">{waitingCount}</span>
            {emergencyCount > 0 && (
              <span className="ml-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                {emergencyCount} P1
              </span>
            )}
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            isOffline
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isOffline ? "bg-amber-500" : "bg-emerald-500 animate-pulse-dot"
            }`}
            aria-hidden="true"
          />
          {isOffline ? "Mô phỏng" : "PatientIntakeService :8082"}
        </span>
      </div>

      {/* Actions + profile */}
      <div className="flex shrink-0 items-center gap-3">
        <PortalSwitcher />
        <button
          type="button"
          aria-label="Thông báo"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Radio className="h-4 w-4" aria-hidden="true" />
          <span
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"
            aria-hidden="true"
          />
        </button>
        <div className="flex items-center gap-2 border-l border-slate-200/80 pl-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
            {user?.fullName?.charAt(0) ?? "T"}
          </span>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-xs font-semibold text-slate-800">
              {user?.fullName ?? "Chưa đăng nhập"}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {user ? ROLE_THEMES[user.role].portalLabel : "Quầy Tiếp Đón"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="Đăng xuất"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
