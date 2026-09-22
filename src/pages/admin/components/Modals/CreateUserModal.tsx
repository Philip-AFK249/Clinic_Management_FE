import { useState } from "react";
import { toast } from "sonner";
import { X, UserPlus } from "lucide-react";
import type { StaffAccount } from "../../data/adminMockData";
import { DOCTOR_TITLE_OPTIONS, MOCK_DEPARTMENTS } from "../../data/adminMockData";

interface CreateUserModalProps {
  onClose: () => void;
  onCreate: (staff: StaffAccount) => void;
}

const ROLE_OPTIONS = [
  { value: "DOCTOR", label: "Bác sĩ (DOCTOR)" },
  { value: "PHARMACIST", label: "Dược sĩ (PHARMACIST)" },
  { value: "NURSE", label: "Điều dưỡng (NURSE)" },
  { value: "ADMIN", label: "Quản trị viên (ADMIN)" },
] as const;

export default function CreateUserModal({ onClose, onCreate }: CreateUserModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffAccount["role"]>("DOCTOR");
  const [departmentId, setDepartmentId] = useState(MOCK_DEPARTMENTS[0]?.id ?? "");
  const [departmentText, setDepartmentText] = useState("");
  const [title, setTitle] = useState<typeof DOCTOR_TITLE_OPTIONS[number]>("BS.CKI");
  const [roomNumber, setRoomNumber] = useState("");

  const isDoctor = role === "DOCTOR";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error("Vui lòng điền đầy đủ Họ tên và Email công việc.");
      return;
    }

    if (isDoctor) {
      if (!departmentId) {
        toast.error("Vui lòng chọn Khoa điều trị cho Bác sĩ.");
        return;
      }
      if (!roomNumber.trim()) {
        toast.error("Bắt buộc nhập Phòng khám đối với tài khoản Bác sĩ.");
        return;
      }
    }

    const selectedDepartment = MOCK_DEPARTMENTS.find((d) => d.id === departmentId);

    const newStaff: StaffAccount = {
      id: `STF-${Date.now().toString().slice(-6)}`,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || "Chưa cập nhật",
      role,
      department: isDoctor
        ? selectedDepartment?.name ?? departmentText.trim()
        : departmentText.trim(),
      departmentId: isDoctor ? selectedDepartment?.id : undefined,
      title: isDoctor ? title : undefined,
      roomNumber: isDoctor ? roomNumber.trim() : undefined,
      status: "ACTIVE",
      lastLogin: "Chưa đăng nhập",
    };

    if (!newStaff.department) {
      toast.error("Vui lòng điền Khoa / Phòng ban.");
      return;
    }

    onCreate(newStaff);
    toast.success(
      `Đã cấp tài khoản ${fullName} (${role}) thành công. Email mời thiết lập mật khẩu đã được gửi.`,
      { duration: 4000 },
    );
    onClose();
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
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
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
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
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
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Vai trò (RBAC) *
            </label>
            <div className="flex gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isDoctor ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Khoa điều trị *
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  >
                    {MOCK_DEPARTMENTS.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Học hàm / Học vị *
                  </label>
                  <select
                    value={title}
                    onChange={(e) => setTitle(e.target.value as typeof DOCTOR_TITLE_OPTIONS[number])}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  >
                    {DOCTOR_TITLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Khoa / Phòng ban *
                </label>
                <input
                  type="text"
                  value={departmentText}
                  onChange={(e) => setDepartmentText(e.target.value)}
                  placeholder="VD: Quầy Dược Lâm Sàng #1"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>
            )}
          </div>

          {isDoctor && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Phòng khám *
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="VD: Phòng 104"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Bắt buộc đối với Bác sĩ - phòng khám được gán cho bác sĩ khi phân ca
                Ngoại trú.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
            >
              <UserPlus size={16} aria-hidden="true" />
              Cấp Tài Khoản
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}