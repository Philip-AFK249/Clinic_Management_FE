import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { X, Loader2, UserPlus } from "lucide-react";
import { createStaffApi, AuthApiError } from "../../../../services/authApi";
import type {
  AuthResponseDto,
  CreateStaffRequestDto,
} from "../../../../services/authApi";
import { getDepartments } from "../../services/scheduleApi";
import type { Department } from "../../services/scheduleApi";
import { useAuth } from "../../../../context/useAuth";
import type { UserRole } from "../../../../types/auth";

interface CreateUserModalProps {
  onClose: () => void;
  onCreated: (staff: AuthResponseDto) => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "DOCTOR", label: "Bác sĩ (DOCTOR)" },
  { value: "PHARMACIST", label: "Dược sĩ (PHARMACIST)" },
  { value: "NURSE", label: "Điều dưỡng (NURSE)" },
  { value: "ADMIN", label: "Quản trị viên (ADMIN)" },
];

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50";

export default function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const { user } = useAuth();
  const token = user?.token;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("DOCTOR");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  const loadDepartments = useCallback(() => {
    Promise.resolve()
      .then(() => setDepartmentsLoading(true))
      .then(() => getDepartments())
      .then((list) => {
        setDepartments(list);
        setDepartmentId((current) =>
          current !== "" ? current : (list[0]?.id ?? ""),
        );
      })
      .catch((error: unknown) => {
        setDepartments([]);
        toast.error(
          error instanceof Error
            ? error.message
            : "Không tải được danh sách Khoa từ DoctorScheduleService.",
        );
      })
      .finally(() => setDepartmentsLoading(false));
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === departmentId),
    [departments, departmentId],
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) {
      toast.error("Phiên quản trị viên không hợp lệ. Vui lòng đăng nhập lại.");
      return;
    }
    if (!fullName.trim() || !email.trim()) {
      toast.error("Vui lòng điền đầy đủ Họ tên và Email công việc.");
      return;
    }
    if (!selectedDepartment) {
      toast.error("Vui lòng chọn Khoa / Phòng ban cho tài khoản.");
      return;
    }

    const payload: CreateStaffRequestDto = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      role,
      departmentId: selectedDepartment.id,
      departmentName: selectedDepartment.name,
    };

    setSubmitting(true);
    try {
      const created = await createStaffApi(payload, token);
      onCreated(created);
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 409) {
        toast.error(
          `Email ${email.trim()} đã được dùng cho một tài khoản khác. Vui lòng chọn email khác.`,
          { duration: 4500 },
        );
        return;
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể cấp tài khoản. Vui lòng thử lại.",
        { duration: 4500 },
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cấp tài khoản mới"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200/80 bg-white shadow-elevated">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-slate-700" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">Cấp Tài Khoản Mới</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Họ và tên *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="VD: BS. CKI. Nguyễn Thị Lan"
              disabled={submitting}
              className={FIELD_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Email công việc *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten.bacsi@smartclinic.vn"
                disabled={submitting}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xx xxx xxx"
                disabled={submitting}
                className={FIELD_CLASS}
              />
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
                  disabled={submitting}
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Khoa / Phòng ban *
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(Number(e.target.value))}
              disabled={submitting || departmentsLoading}
              className={FIELD_CLASS}
            >
              {departmentsLoading && <option value="">Đang tải danh sách Khoa...</option>}
              {!departmentsLoading && departments.length === 0 && (
                <option value="">-- Không tải được danh sách Khoa --</option>
              )}
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Danh sách khoa đọc từ DoctorScheduleService (:8081); khoa được lưu
              kèm tài khoản và dùng để định tuyến bệnh nhân khi bác sĩ / điều dưỡng
              vào ca trực.
            </p>
          </div>

          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            AuthService tự gán mật khẩu mặc định{" "}
            <span className="font-semibold text-slate-700">password123</span> cho
            tài khoản mới - quản trị viên nên đặt lại mật khẩu sau lần đăng nhập
            đầu tiên.
          </p>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Đang cấp tài khoản...
                </>
              ) : (
                <>
                  <UserPlus size={16} aria-hidden="true" />
                  Cấp Tài Khoản
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
