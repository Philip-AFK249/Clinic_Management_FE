import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { X, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updateStaffByAdminApi } from "../../../../services/authApi";
import type {
  AuthResponseDto,
  UpdateStaffRequestDto,
} from "../../../../services/authApi";
import { getDepartments } from "../../services/scheduleApi";
import type { Department } from "../../services/scheduleApi";
import type { UserRole } from "../../../../types/auth";

interface EditUserModalProps {
  staff: AuthResponseDto;
  token: string | undefined;
  onClose: () => void;
  onSaved: (staff: AuthResponseDto) => void;
}

/** Roles an admin may reassign to from this console. */
const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "DOCTOR", label: "Bác sĩ (DOCTOR)" },
  { value: "PHARMACIST", label: "Dược sĩ (PHARMACIST)" },
  { value: "NURSE", label: "Điều dưỡng (NURSE)" },
  { value: "ADMIN", label: "Quản trị viên (ADMIN)" },
];

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50";

export default function EditUserModal({
  staff,
  token,
  onClose,
  onSaved,
}: EditUserModalProps) {
  const [fullName, setFullName] = useState(staff.fullName ?? "");
  const [phone, setPhone] = useState(staff.phone ?? "");
  const [role, setRole] = useState<UserRole>(staff.role);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<number | "">(
    staff.departmentId ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);

  // Department names live on the schedule service; AuthService only stores the
  // id, so the option list is fetched once when the modal opens.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => getDepartments())
      .then((list) => {
        if (!cancelled) setDepartments(list);
      })
      .catch(() => {
        // The stored id is still submitted; the select simply falls back to the
        // account's own department name.
        if (!cancelled) setDepartments([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === departmentId),
    [departments, departmentId],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      toast.error("Phiên quản trị viên không hợp lệ. Vui lòng đăng nhập lại.");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Họ và tên không được để trống.");
      return;
    }

    const payload: UpdateStaffRequestDto = {
      fullName: fullName.trim(),
      phone: phone.trim() || null,
      role,
      departmentId: departmentId === "" ? null : departmentId,
      departmentName: selectedDepartment?.name ?? staff.departmentName ?? null,
      // Carried through unchanged: these ids tie the account to its doctor /
      // pharmacist record and are not editable from this screen.
      doctorId: staff.doctorId,
      pharmacistId: staff.pharmacistId,
    };

    setIsSaving(true);
    try {
      const updated = await updateStaffByAdminApi(
        staff.userId,
        payload,
        token,
      );
      onSaved(updated);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Không thể cập nhật tài khoản nhân sự.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Chỉnh sửa tài khoản ${staff.fullName}`}
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200/80 bg-white shadow-elevated">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              Chỉnh Sửa Tài Khoản &amp; Phân Quyền
            </h3>
            <p className="truncate text-[11px] text-slate-500">
              {staff.email} · users.id = {staff.userId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Họ và tên *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSaving}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Email công việc
              </label>
              <input
                type="email"
                value={staff.email ?? ""}
                readOnly
                disabled
                title="AuthService không cho phép đổi email của tài khoản."
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xx xxx xxx"
                disabled={isSaving}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Khoa / Phòng ban
              </label>
              <select
                value={departmentId}
                onChange={(e) =>
                  setDepartmentId(e.target.value === "" ? "" : Number(e.target.value))
                }
                disabled={isSaving}
                className={FIELD_CLASS}
              >
                <option value="">
                  {staff.departmentName || "-- Không thuộc khoa nào --"}
                </option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Vai trò (RBAC) *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  disabled={isSaving}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    role === opt.value
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {staff.role !== role && (
              <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                Đổi vai trò sẽ thay đổi quyền truy cập ngay khi tài khoản đăng nhập
                lại. Tài khoản đang mở phiên có thể cần đăng xuất.
              </p>
            )}
          </div>

          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Học hàm / học vị và phòng khám không nằm trên tài khoản AuthService -
            chúng thuộc danh bác sĩ của DoctorScheduleService (:8081) và được quản
            lý trong tab Thời khoá biểu tuần.
          </p>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save size={16} aria-hidden="true" />
                  Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
