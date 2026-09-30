import { useState, type FormEvent } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Stethoscope,
  Building2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/useAuth";
import {
  DEMO_PASSWORD,
  demoAccountFor,
  ROLE_HOME,
} from "../../types/auth";
import type { User, UserRole } from "../../types/auth";
import { ROLE_LABELS, ROLE_ORDER } from "../../config/roleThemes";
import type { AuthOutletContext } from "../../config/roleThemes";
import {
  CLINICAL_DEPARTMENTS,
  doctorsOfDepartment,
  FALLBACK_DEPARTMENT_ID,
  initialsOf,
} from "../doctor/data/doctorDirectory";
import type { DoctorProfile } from "../doctor/data/doctorDirectory";
import {
  NURSE_DIRECTORY,
  nurseDepartmentName,
} from "../reception/data/nurseDirectory";

interface PickedIdentity {
  email: string;
  password: string;
  departmentId: number;
  doctorId: number | null;
}

/**
 * The account a role/khoa/doctor selection resolves to. Doctors come from
 * DOCTOR_DIRECTORY so the picker, the directory and the stamped encounter
 * department can never disagree.
 */
function identityFor(
  role: UserRole,
  departmentId: number,
  doctor?: DoctorProfile,
): PickedIdentity {
  if (role === "DOCTOR") {
    const chosen = doctor ?? doctorsOfDepartment(departmentId)[0];
    return {
      email: chosen?.email ?? "",
      password: DEMO_PASSWORD,
      departmentId: chosen?.departmentId ?? departmentId,
      doctorId: chosen?.id ?? null,
    };
  }

  const account = demoAccountFor(role);
  return {
    email: account?.email ?? "",
    password: account?.password ?? "",
    departmentId: account?.departmentId ?? departmentId,
    doctorId: null,
  };
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.62H1.27a12 12 0 0 0 0 10.76l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.27 6.62l4 3.1c.95-2.35 3.6-4.96 6.73-4.96Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { activeRole, setActiveRole, theme } = useOutletContext<AuthOutletContext>();

  // Seeded from the role the layout resolved from ?role=, so arriving at
  // /login?role=DOCTOR already shows a usable doctor identity.
  const [email, setEmail] = useState(
    () => identityFor(activeRole, FALLBACK_DEPARTMENT_ID).email,
  );
  const [password, setPassword] = useState(
    () => identityFor(activeRole, FALLBACK_DEPARTMENT_ID).password,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(
    FALLBACK_DEPARTMENT_ID,
  );
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(
    () => identityFor(activeRole, FALLBACK_DEPARTMENT_ID).doctorId,
  );

  const selectedDoctors = doctorsOfDepartment(selectedDepartmentId);

  function applyIdentity(identity: PickedIdentity) {
    setEmail(identity.email);
    setPassword(identity.password);
    setSelectedDepartmentId(identity.departmentId);
    setSelectedDoctorId(identity.doctorId);
    setErrors({});
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = "Vui lòng nhập địa chỉ email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Địa chỉ email không đúng định dạng.";
    }
    if (!password) {
      next.password = "Vui lòng nhập mật khẩu.";
    } else if (password.length < 6) {
      next.password = "Mật khẩu phải có tối thiểu 6 ký tự.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSelectRole(role: UserRole) {
    setActiveRole(role);
    const account = demoAccountFor(role);
    const departmentId =
      role === "DOCTOR"
        ? FALLBACK_DEPARTMENT_ID
        : (account?.departmentId ?? FALLBACK_DEPARTMENT_ID);
    applyIdentity(identityFor(role, departmentId));
  }

  function handleSelectDepartment(departmentId: number) {
    // Landing on a khoa pre-picks its first bác sĩ so the form stays submittable.
    applyIdentity(identityFor("DOCTOR", departmentId));
  }

  function handleSelectDoctor(doctor: DoctorProfile) {
    applyIdentity(identityFor("DOCTOR", doctor.departmentId, doctor));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const user = await login(
        { email, password },
        activeRole,
        { departmentId: selectedDepartmentId },
      );
      completeSignIn(user);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.",
      );
    } finally {
      setLoading(false);
    }
  }

  /**
   * The clicked chip is only a guess: AuthService decides the role. When the two
   * disagree the account is signed into the portal it actually has access to,
   * with a warning, rather than landing somewhere that will 401.
   */
  function completeSignIn(user: User) {
    if (user.role !== activeRole) {
      toast.warning(
        `Tài khoản này thuộc vai trò ${ROLE_LABELS[user.role].label}, không phải ${ROLE_LABELS[activeRole].label}. Đã chuyển bạn sang đúng cổng.`,
        { duration: 5000 },
      );
    }
    if (user.role === "DOCTOR" && user.doctorId === undefined) {
      toast.warning(
        "Tài khoản bác sĩ chưa được liên kết với hồ sơ bác sĩ (doctorId) trên hệ thống. Vui lòng liên hệ Quản trị viên.",
        { duration: 6000 },
      );
    }
    toast.success(`Chào mừng trở lại, ${user.fullName}`);
    navigate(ROLE_HOME[user.role]);
  }

  async function handleGoogleSignin() {
    // Signs in whatever the picker resolved to, so a chosen bác sĩ survives.
    const identity = email && password
      ? { email, password }
      : identityFor(activeRole, selectedDepartmentId);

    setLoading(true);
    try {
      const user = await login(
        { email: identity.email, password: identity.password },
        activeRole,
        { departmentId: selectedDepartmentId },
      );
      toast.success(
        `Đăng nhập Google thành công với vai trò ${theme.portalLabel}`,
      );
      navigate(ROLE_HOME[user.role]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Đăng nhập Google không thành công.",
      );
    } finally {
      setLoading(false);
    }
  }

  const inputBase =
    "h-11 w-full rounded-lg border bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2";
  const inputNormal = `border-slate-200 ${theme.focusClasses}`;
  const inputError =
    "border-triage-p1 focus:border-triage-p1 focus:ring-triage-p1/20";
  const chipIdle =
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="mb-3">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-300 ease-in-out ${theme.badge}`}>
            {theme.portalLabel}
          </span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Đăng nhập hệ thống
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Nhập thông tin tài khoản để truy cập vào hệ thống phòng khám.
        </p>
      </div>

      {/* Role selector */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
        <p className="mb-3 text-xs font-medium text-slate-500">
          Chọn vai trò đăng nhập
        </p>
        <div
          role="radiogroup"
          aria-label="Vai trò đăng nhập"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {ROLE_ORDER.map((role) => {
            const isActive = role === activeRole;
            const { label, emoji } = ROLE_LABELS[role];
            return (
              <button
                key={role}
                type="button"
                role="radio"
                aria-checked={isActive}
                disabled={loading}
                onClick={() => handleSelectRole(role)}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all duration-300 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-600 disabled:opacity-50 ${
                  isActive ? theme.chipActive : chipIdle
                }`}
              >
                <span aria-hidden="true" className="text-sm leading-none">
                  {emoji}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Role-specific pickers */}
      <div
        key={activeRole}
        className="animate-fade-rise space-y-4 motion-reduce:animate-none"
      >
        {activeRole === "DOCTOR" && (
          <>
            <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
                <Building2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Khoa phụ trách
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {CLINICAL_DEPARTMENTS.map((department) => {
                  const isActive = department.id === selectedDepartmentId;
                  return (
                    <button
                      key={department.id}
                      type="button"
                      aria-pressed={isActive}
                      disabled={loading}
                      onClick={() => handleSelectDepartment(department.id)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-all duration-300 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-600 disabled:opacity-50 ${
                        isActive ? theme.chipActive : chipIdle
                      }`}
                    >
                      <span className="block text-xs font-semibold">
                        {department.shortName}
                      </span>
                      <span
                        className={`mt-1 block text-[11px] leading-snug ${
                          isActive ? "text-white/85" : "text-slate-500"
                        }`}
                      >
                        {department.specialties}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section
              key={selectedDepartmentId}
              className="animate-fade-rise rounded-xl border border-slate-200/80 bg-white p-4 shadow-card motion-reduce:animate-none"
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-500">
                <Stethoscope className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Bác sĩ trực (
                {CLINICAL_DEPARTMENTS.find(
                  (department) => department.id === selectedDepartmentId,
                )?.shortName ?? "Chuyên khoa"}
                )
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedDoctors.map((doctor) => {
                  const isActive = doctor.id === selectedDoctorId;
                  return (
                    <button
                      key={doctor.id}
                      type="button"
                      aria-pressed={isActive}
                      disabled={loading}
                      onClick={() => handleSelectDoctor(doctor)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-300 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-600 disabled:opacity-50 ${
                        isActive ? theme.chipActive : chipIdle
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {initialsOf(doctor.fullName)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">
                          {doctor.fullName}
                        </span>
                        <span
                          className={`block text-[11px] ${
                            isActive ? "text-white/85" : "text-slate-500"
                          }`}
                        >
                          {doctor.roomNumber}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {activeRole === "NURSE" && (
          <section className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
            <span
              aria-hidden="true"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${theme.badge}`}
            >
              <UserRound className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {NURSE_DIRECTORY[0].fullName}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Bàn tiếp đón & sàng lọc sinh hiệu —{" "}
                {nurseDepartmentName(NURSE_DIRECTORY[0])}
              </p>
            </div>
          </section>
        )}
      </div>

      {/* Continue with Google */}
      <button
        type="button"
        disabled={loading}
        onClick={handleGoogleSignin}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-slate-200/90 bg-white px-5 text-sm font-medium text-slate-700 shadow-card transition-colors duration-300 ease-in-out hover:bg-slate-50 hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-50"
      >
        <GoogleIcon />
        Tiếp tục với Google
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface-light px-3 text-slate-400">
            hoặc đăng nhập bằng email
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Email */}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Địa chỉ Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="bacsi@smartclinic.vn"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
              className={`${inputBase} ${errors.email ? inputError : inputNormal}`}
            />
          </div>
          {errors.email && <p className="mt-1 text-xs text-triage-p1">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu của bạn"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
              className={`${inputBase} pr-11 ${errors.password ? inputError : inputNormal}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-600"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-triage-p1">{errors.password}</p>}
        </div>

        {/* Remember & Forgot */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-clinical-600 focus:ring-clinical-500"
            />
            Ghi nhớ đăng nhập
          </label>
          <Link
            to="#"
            className="text-sm font-medium text-cta transition-colors hover:text-cta-hover"
          >
            Quên mật khẩu?
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className={`flex h-11 w-full items-center justify-center rounded-lg px-5 text-sm font-semibold text-white shadow-card transition-colors duration-300 ease-in-out hover:shadow-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-600 disabled:opacity-50 ${theme.button}`}
        >
          {loading ? "Đang xác thực..." : "Đăng nhập"}
        </button>
      </form>

      {/* Footer link */}
      <p className="text-center text-sm text-slate-500">
        Chưa có tài khoản?{" "}
        <Link to="/register" className="font-medium text-cta transition-colors hover:text-cta-hover">
          Đăng ký ngay
        </Link>
      </p>
    </div>
  );
}
