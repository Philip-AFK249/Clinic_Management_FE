import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Edit,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  resetUserPasswordApi,
  toggleUserStatusApi,
} from "../../../services/authApi";
import type { AuthResponseDto } from "../../../services/authApi";
import { useAuth } from "../../../context/useAuth";
import { useAdminStaff } from "../hooks/useAdminStaff";
import {
  filterStaff,
  isStaffLocked,
  staffCreatedAt,
  staffInitials,
  staffRoleCounts,
  staffRoleLabel,
  STAFF_ROLE_BADGE_COLORS,
  STAFF_ROLE_FILTERS,
} from "../data/staffFilters";
import type { StaffRoleFilter } from "../data/staffFilters";
import CreateUserModal from "./Modals/CreateUserModal";
import EditUserModal from "./Modals/EditUserModal";

const PAGE_SIZE = 10;

export default function UserManagementTab() {
  const { user } = useAuth();
  const token = user?.token;
  const { staff, isLoading, error, isUnavailable, refresh, applyStaff, addStaff } =
    useAdminStaff();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRoleFilter>("ALL");
  const [page, setPage] = useState(1);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState<AuthResponseDto | null>(null);

  const counts = useMemo(() => staffRoleCounts(staff), [staff]);

  const filtered = useMemo(
    () => filterStaff(staff, searchQuery, roleFilter),
    [staff, searchQuery, roleFilter],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const effectivePage = Math.min(page, pageCount);
  const paginated = filtered.slice(
    (effectivePage - 1) * PAGE_SIZE,
    effectivePage * PAGE_SIZE,
  );

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setPage(1);
  }

  function handleRoleFilterChange(value: StaffRoleFilter) {
    setRoleFilter(value);
    setPage(1);
  }

  async function handleToggleStatus(target: AuthResponseDto) {
    if (busyUserId !== null) return;
    setBusyUserId(target.userId);
    try {
      const updated = await toggleUserStatusApi(target.userId, token);
      applyStaff(updated);
      // `active` is absent on a pre-`active` payload: fall back to the flip we
      // asked for rather than reporting the opposite of what happened.
      const unlocked = updated.active ?? !isStaffLocked(target);
      toast.success(
        unlocked
          ? "Đã mở khóa tài khoản thành công."
          : "Đã khóa tài khoản thành công.",
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Không thể thay đổi trạng thái tài khoản.",
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleResetPassword(target: AuthResponseDto) {
    if (busyUserId !== null) return;
    const name = target.fullName;
    setBusyUserId(target.userId);
    try {
      await resetUserPasswordApi(target.userId, token);
      toast.success(
        `Đã đặt lại mật khẩu cho ${name} về mặc định 'password123'.`,
        { duration: 4500 },
      );
    } catch {
      toast.error("Không thể đặt lại mật khẩu. Vui lòng thử lại.");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Danh Sách Nhân Sự &amp; Tài Khoản Phân Quyền (RBAC)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Dữ liệu trực tiếp từ AuthService (:8085) - tài khoản, vai trò và quyền
            truy cập hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={isLoading ? "animate-spin" : ""}
              aria-hidden="true"
            />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
          >
            <Plus size={16} aria-hidden="true" />
            Cấp Tài Khoản Mới
          </button>
        </div>
      </div>

      {isUnavailable && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-bold text-amber-800">
              Không tải được danh sách nhân sự
            </p>
            <p className="mt-0.5 text-xs text-amber-700">{error}</p>
            <p className="mt-1 text-[11px] text-amber-600">
              Endpoint <code>/api/v1/auth/admin/users</code> cần được triển khai và
              khởi động trên AuthService (:8085).
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Đang tải danh sách nhân sự...
        </div>
      )}

      {!isLoading && (
        <>
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
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Tìm theo tên, email, SĐT hoặc khoa..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {STAFF_ROLE_FILTERS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleRoleFilterChange(opt.value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    roleFilter === opt.value
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {opt.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      roleFilter === opt.value
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-500"
                    }`}
                  >
                    {counts[opt.value]}
                  </span>
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
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Nhân viên
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Vai trò
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Khối / Phòng
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Email &amp; SĐT
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Tạo tài khoản
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Trạng thái
                    </th>
                    <th className="px-4 py-3 font-semibold text-slate-600">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((account) => {
                    const locked = isStaffLocked(account);
                    const busy = busyUserId === account.userId;
                    const createdAt = staffCreatedAt(account.createdAt);

                    return (
                      <tr
                        key={account.userId}
                        className="transition-colors hover:bg-slate-50/50"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                              {staffInitials(account.fullName)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">
                                {account.fullName}
                              </p>
                              <p className="truncate text-[11px] text-slate-400">
                                users.id = {account.userId}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STAFF_ROLE_BADGE_COLORS[account.role]}`}
                          >
                            <ShieldCheck size={10} aria-hidden="true" />
                            {staffRoleLabel(account.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <p>{account.departmentName || "—"}</p>
                          {typeof account.doctorId === "number" && (
                            <p className="text-[11px] text-slate-400">
                              doctors.id = {account.doctorId}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-600">{account.email}</p>
                          <p className="text-[11px] text-slate-400">
                            {account.phone || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {createdAt ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              locked
                                ? "bg-red-50 text-red-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                locked ? "bg-red-500" : "bg-emerald-500"
                              }`}
                            />
                            {locked ? "Đã khóa" : "Hoạt động"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditing(account)}
                              disabled={busy}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                              title="Chỉnh sửa thông tin & phân quyền"
                              aria-label={`Chỉnh sửa tài khoản ${account.fullName}`}
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleStatus(account)}
                              disabled={busy}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                              title={locked ? "Mở khóa tài khoản" : "Khóa tài khoản"}
                              aria-label={
                                locked
                                  ? `Mở khóa tài khoản ${account.fullName}`
                                  : `Khóa tài khoản ${account.fullName}`
                              }
                            >
                              {locked ? (
                                <Unlock size={14} />
                              ) : (
                                <Lock size={14} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleResetPassword(account)}
                              disabled={busy}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                              title="Đặt lại mật khẩu về 'password123'"
                              aria-label={`Đặt lại mật khẩu ${account.fullName}`}
                            >
                              {busy ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <KeyRound size={14} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-slate-400"
                      >
                        {staff.length === 0
                          ? "Chưa có tài khoản nhân sự nào trong hệ thống."
                          : "Không tìm thấy nhân sự phù hợp với bộ lọc."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-slate-500">
              Hiển thị{" "}
              <span className="font-semibold text-slate-700">
                {filtered.length === 0
                  ? 0
                  : (effectivePage - 1) * PAGE_SIZE + 1}
                -{Math.min(effectivePage * PAGE_SIZE, filtered.length)}
              </span>{" "}
              trong{" "}
              <span className="font-semibold text-slate-700">
                {filtered.length}
              </span>{" "}
              nhân sự
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={effectivePage <= 1}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} aria-hidden="true" />
                Trước
              </button>
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                Trang {effectivePage} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={effectivePage >= pageCount}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sau
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(created) => {
            addStaff(created);
            setShowCreateModal(false);
            toast.success("Đã cấp tài khoản thành công.", { duration: 4000 });
          }}
        />
      )}

      {editing && (
        <EditUserModal
          staff={editing}
          token={token}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            applyStaff(updated);
            setEditing(null);
            toast.success(
              `Đã cập nhật tài khoản của ${updated.fullName}.`,
            );
          }}
        />
      )}
    </div>
  );
}
