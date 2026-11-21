import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Brain,
  Pill,
  ChevronLeft,
  ChevronRight,
  Database,
  HeartPulse,
} from "lucide-react";
import type { AdminTab } from "../data/adminMockData";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const NAV_ITEMS: { tab: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { tab: "OVERVIEW", label: "Tổng quan Vận hành", icon: LayoutDashboard },
  { tab: "ROSTER", label: "Lịch trực & Phân ca Bác sĩ", icon: CalendarDays },
  { tab: "USERS", label: "Quản lý Nhân sự (RBAC)", icon: Users },
  { tab: "PATIENTS", label: "Quản lý Bệnh nhân & BHYT", icon: HeartPulse },
  { tab: "CATALOGS", label: "Danh mục Thuốc & Viện phí", icon: Pill },
  { tab: "AI_GATEWAY", label: "AI Gateway & Logs", icon: Brain },
];

export default function AdminSidebar({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
}: AdminSidebarProps) {
  return (
    <aside
      className={`flex h-full flex-col bg-slate-900 text-white transition-all duration-200 ${
        collapsed ? "w-16" : "w-[260px]"
      }`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-700/50 px-4">
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-wide text-white">Smart Clinic</p>
            <p className="text-[11px] font-medium text-slate-400">Quản Trị Viên</p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onTabChange(item.tab)}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-800 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                size={20}
                className={`shrink-0 ${isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}
                aria-hidden="true"
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-slate-700/50 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Database size={12} aria-hidden="true" />
            <span>PostgreSQL 16 + pgvector</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
            <span className="text-[11px] text-slate-400">Kết nối ổn định</span>
          </div>
        </div>
      )}
    </aside>
  );
}
