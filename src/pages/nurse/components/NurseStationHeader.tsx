import { HeartPulse, LogOut, Radio, Syringe, Users } from "lucide-react";
import { useAuth } from "../../../context/useAuth";
import { ROLE_THEMES } from "../../../config/roleThemes";
import PortalSwitcher from "../../../components/PortalSwitcher";
import type { NurseProfile } from "../../reception/data/nurseDirectory";

interface NurseStationHeaderProps {
  nurse: NurseProfile;
  departmentName: string;
  waitingCount: number;
  emergencyCount: number;
  measuredCount: number;
  isOffline: boolean;
}

/**
 * Nurse station chrome: brand, the khoa / bàn trực the nurse is posted to, live
 * queue counters and the shared portal switcher. Violet is the NURSE theme in
 * `config/roleThemes.ts`.
 */
export default function NurseStationHeader({
  nurse,
  departmentName,
  waitingCount,
  emergencyCount,
  measuredCount,
  isOffline,
}: NurseStationHeaderProps) {
  const { user, logout } = useAuth();
  const theme = ROLE_THEMES.NURSE;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white px-4">
      {/* Brand + post */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
          <Syringe className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-slate-900">
            Smart Clinic{" "}
            <span className="ml-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
              Điều Dưỡng Lâm Sàng
            </span>
          </p>
          <p className="truncate text-xs text-slate-500">
            {nurse.roomNumber ?? "Chưa phân bàn trực"} &middot; {departmentName}
          </p>
        </div>
      </div>

      {/* Queue metrics */}
      <div className="hidden items-center gap-5 lg:flex">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-600" aria-hidden="true" />
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
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <HeartPulse className="h-4 w-4 text-violet-600" aria-hidden="true" />
          Đã đo sinh hiệu:{" "}
          <span className="font-bold text-slate-900">{measuredCount}</span>
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
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${theme.badge}`}
          >
            {user?.fullName?.charAt(0) ?? "Đ"}
          </span>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-xs font-semibold text-slate-800">
              {nurse.fullName || user?.fullName || "Chưa đăng nhập"}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {nurse.title ?? theme.portalLabel}
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
