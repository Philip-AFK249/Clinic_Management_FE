import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, Phone, Info } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/useAuth";
import { ROLE_HOME } from "../../types/auth";
import type { Gender } from "../../types/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!fullName.trim()) next.fullName = "Vui lòng nhập họ và tên.";
    if (!phone.trim()) next.phone = "Vui lòng nhập số điện thoại hợp lệ.";
    if (!email.trim()) {
      next.email = "Vui lòng nhập email hợp lệ.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Vui lòng nhập email hợp lệ.";
    }
    if (!password) {
      next.password = "Vui lòng nhập mật khẩu.";
    } else if (password.length < 8) {
      next.password = "Mật khẩu phải có tối thiểu 8 ký tự.";
    }
    if (!confirmPassword) {
      next.confirmPassword = "Vui lòng xác nhận lại mật khẩu.";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const user = await register({
        fullName,
        email,
        phone,
        password,
        confirmPassword,
        role: "PATIENT",
        dateOfBirth: dob || undefined,
        gender: (gender as Gender) || undefined,
      });
      toast.success(
        `Chào mừng ${user.fullName}. Tài khoản đã được tạo thành công.`,
      );
      navigate(ROLE_HOME[user.role]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Đăng ký không thành công. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }

  function fieldClass(key: string) {
    return `h-11 w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:outline-none ${
      errors[key]
        ? "border-triage-p1 focus:border-triage-p1 focus:ring-2 focus:ring-triage-p1/20"
        : "border-slate-200 focus:border-clinical-600 focus:ring-2 focus:ring-clinical-500/20"
    }`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Tạo tài khoản Bệnh nhân
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Đăng ký tài khoản để chủ động đặt lịch khám và tra cứu hồ sơ bệnh án
          điện tử.
        </p>
      </div>

      {/* Staff Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-clinical-600" />
        <div>
          <p className="text-sm font-medium text-slate-900">
            Dành cho Nhân viên y tế
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Tài khoản Bác sĩ, Dược sĩ và Quản trị viên được tạo và phân quyền
            nội bộ bởi Quản trị viên hệ thống. Vui lòng liên hệ bộ phận CNTT
            của phòng khám để nhận tài khoản công tác.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Full Name */}
        <div>
          <label htmlFor="reg-name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Họ và tên
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              placeholder="Nguyễn Văn An"
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setErrors((p) => { const n = { ...p }; delete n.fullName; return n; }); }}
              className={fieldClass("fullName")}
            />
          </div>
          {errors.fullName && <p className="mt-1 text-xs text-triage-p1">{errors.fullName}</p>}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="reg-phone" className="mb-1.5 block text-sm font-medium text-slate-700">
            Số điện thoại liên hệ
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              id="reg-phone"
              type="tel"
              autoComplete="tel"
              placeholder="0912 345 678"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setErrors((p) => { const n = { ...p }; delete n.phone; return n; }); }}
              className={fieldClass("phone")}
            />
          </div>
          {errors.phone && <p className="mt-1 text-xs text-triage-p1">{errors.phone}</p>}
        </div>

        {/* DOB & Gender row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-dob" className="mb-1.5 block text-sm font-medium text-slate-700">
              Ngày sinh
            </label>
            <input
              id="reg-dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 transition-colors focus:border-clinical-600 focus:outline-none focus:ring-2 focus:ring-clinical-500/20"
            />
          </div>
          <div>
            <label htmlFor="reg-gender" className="mb-1.5 block text-sm font-medium text-slate-700">
              Giới tính
            </label>
            <select
              id="reg-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | "")}
              className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 transition-colors focus:border-clinical-600 focus:outline-none focus:ring-2 focus:ring-clinical-500/20"
            >
              <option value="">Chọn giới tính</option>
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </select>
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="reg-email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Địa chỉ Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="nguyenvanan@gmail.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => { const n = { ...p }; delete n.email; return n; }); }}
              className={fieldClass("email")}
            />
          </div>
          {errors.email && <p className="mt-1 text-xs text-triage-p1">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="reg-password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              placeholder="Tối thiểu 8 ký tự"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((p) => { const n = { ...p }; delete n.password; return n; }); }}
              className={fieldClass("password")}
            />
          </div>
          {errors.password && <p className="mt-1 text-xs text-triage-p1">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="reg-confirm" className="mb-1.5 block text-sm font-medium text-slate-700">
            Xác nhận mật khẩu
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              id="reg-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu vừa tạo"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => { const n = { ...p }; delete n.confirmPassword; return n; }); }}
              className={fieldClass("confirmPassword")}
            />
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-triage-p1">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center rounded-lg bg-clinical-600 px-5 text-sm font-semibold text-white shadow-card transition-all hover:bg-clinical-700 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-600 disabled:opacity-50"
        >
          {loading ? "Đang xử lý tạo tài khoản..." : "Tạo tài khoản"}
        </button>
      </form>

      {/* Footer link */}
      <p className="text-center text-sm text-slate-500">
        Đã có tài khoản?{" "}
        <Link to="/login" className="font-medium text-cta transition-colors hover:text-cta-hover">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
