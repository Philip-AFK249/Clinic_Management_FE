import { Bell, FileText, LogOut, Stethoscope, Users } from "lucide-react";
import PortalSwitcher from "../../../components/PortalSwitcher";
import { useAuth } from "../../../context/useAuth";
import { useDoctorSession } from "../hooks/useDoctorSession";

interface DoctorHeaderProps {
  waitingCount: number;
  emergencyCount: number;
}

const SEEN_TODAY = 12;
const AVG_CONSULTATION = "9.4 phút";

export default function DoctorHeader({
  waitingCount,
  emergencyCount,
}: DoctorHeaderProps) {
  const { profile, initials, isSeeded } = useDoctorSession();
  const { logout } = useAuth();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-3">
      {/* Brand */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
          <Stethoscope className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-slate-900">
            Smart Clinic{" "}
            <span className="ml-1 rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
              Bác sĩ (EHR Portal)
            </span>
          </p>
          <p className="truncate text-xs text-slate-500">
            {profile.roomNumber} &middot; {profile.departmentName}
          </p>
        </div>
      </div>

      {/* Consultation metrics */}
      <div className="hidden items-center gap-5 lg:flex">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-teal-600" />
          <span className="text-xs font-medium text-slate-600">
            Hàng đợi:{" "}
            <span className="font-bold text-slate-900">
              {waitingCount} bệnh nhân chờ
            </span>{" "}
            {emergencyCount > 0 && (
              <span className="rounded-full bg-red-50 px-1.5 py-0.5 font-semibold text-red-700">
                {emergencyCount} Khẩn cấp
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-teal-600" />
          <span className="text-xs font-medium text-slate-600">
            Đã khám hôm nay:{" "}
            <span className="font-bold text-slate-900">
              {SEEN_TODAY} bệnh nhân
            </span>
          </span>
        </div>
        <div className="text-xs font-medium text-slate-600">
          Thời gian khám TB:{" "}
          <span className="font-bold text-slate-900">{AVG_CONSULTATION}</span>
        </div>
      </div>

      {/* Station status + profile + logout */}
      <div className="flex shrink-0 items-center gap-2">
        <PortalSwitcher />
        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Đang nhận bệnh nhân
        </span>
        <button
          type="button"
          aria-label="Thông báo"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 items-center gap-2 border-l border-slate-200/80 pl-2">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700"
            aria-hidden="true"
          >
            {initials}
          </span>
          <div className="min-w-0 max-w-40">
            <p className="truncate text-xs font-semibold text-slate-900">
              {profile.fullName}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {profile.credential || profile.title || "Bác sĩ"} &middot;{" "}
              {profile.roomNumber}
            </p>
          </div>
        </div>
        {!isSeeded && (
          <span
            className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 xl:inline-block"
            title="Tài khoản chưa được liên kết với bản ghi Bác sĩ trong hệ thống phân ca."
          >
            Chưa liên kết danh mục
          </span>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          title="Đăng xuất khỏi hệ thống"
          aria-label="Đăng xuất"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
