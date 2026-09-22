import { useState } from "react";
import {
  Search,
  Plus,
  ShieldCheck,
  Lock,
  Unlock,
  RefreshCw,
  Edit,
} from "lucide-react";
import type { StaffAccount } from "../data/adminMockData";
import { ROLE_LABELS } from "../data/adminMockData";
import CreateUserModal from "./Modals/CreateUserModal";

interface UserManagementTabProps {
  staffList: StaffAccount[];
  onToggleStatus: (staffId: string) => void;
  onResetPassword: (staffId: string) => void;
  onAddStaff: (staff: StaffAccount) => void;
}

const ROLE_FILTER_OPTIONS = [
  { value: "ALL", label: "Tất cả" },
  { value: "DOCTOR", label: "Bác sĩ" },
  { value: "PHARMACIST", label: "Dược sĩ" },
  { value: "NURSE", label: "Điều dưỡng" },
  { value: "ADMIN", label: "Quản trị viên" },
] as const;

export default function UserManagementTab({
  staffList,
  onToggleStatus,
  onResetPassword,
  onAddStaff,
}: UserManagementTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filtered = staffList.filter((s) => {
    const matchesSearch =
      searchQuery === "" ||
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleBadgeColors: Record<StaffAccount["role"], string> = {
    DOCTOR: "bg-teal-100 text-teal-800 border-teal-200",
    PHARMACIST: "bg-emerald-100 text-emerald-800 border-emerald-200",
    NURSE: "bg-violet-100 text-violet-800 border-violet-200",
    ADMIN: "bg-slate-100 text-slate-800 border-slate-300",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Danh Sách Nhân Sự & Tài Khoản Phân Quyền (RBAC)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Quản lý tài khoản, vai trò và quyền truy cập hệ thống
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
        >
          <Plus size={16} aria-hidden="true" />
          Cấp Tài Khoản Mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc email..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {ROLE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRoleFilter(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                roleFilter === opt.value
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 font-semibold text-slate-600">Nhân viên</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Vai trò</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Khoa / Phòng</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Email & SĐT</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Đăng nhập gần nhất</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((staff) => (
                <tr key={staff.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                        {staff.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">
                          {staff.fullName}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {staff.id}
                          {staff.title ? ` · ${staff.title}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${roleBadgeColors[staff.role]}`}
                    >
                      <ShieldCheck size={10} aria-hidden="true" />
                      {ROLE_LABELS[staff.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{staff.department}</p>
                    {staff.roomNumber && (
                      <p className="text-[11px] text-slate-400">{staff.roomNumber}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-600">{staff.email}</p>
                    <p className="text-[11px] text-slate-400">{staff.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{staff.lastLogin}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        staff.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          staff.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      {staff.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleStatus(staff.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title={staff.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa"}
                      >
                        {staff.status === "ACTIVE" ? (
                          <Lock size={14} />
                        ) : (
                          <Unlock size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onResetPassword(staff.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title="Đặt lại mật khẩu"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title="Chỉnh sửa phân quyền"
                      >
                        <Edit size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    Không tìm thấy nhân sự phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreate={onAddStaff}
        />
      )}
    </div>
  );
}
