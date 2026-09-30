import { useState } from "react";
import { Link, Outlet, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { ROLE_THEMES } from "../../config/roleThemes";
import type { UserRole } from "../../types/auth";

const VALID_ROLES: UserRole[] = [
  "PATIENT",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "PHARMACIST",
  "ADMIN",
];

const FEATURES = [
  "Bảo mật dữ liệu chuẩn HIPAA & Nghị định 13/2023/NĐ-CP",
  "Hạ tầng máy chủ đạt tiêu chuẩn bảo mật ISO 27001",
  "Chuẩn hóa và liên thông dữ liệu y tế HL7 FHIR R4",
  "Trợ lý AI hỗ trợ ra quyết định lâm sàng và sàng lọc",
];

export default function AuthLayout() {
  const [searchParams] = useSearchParams();
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    const param = searchParams.get("role") as UserRole | null;
    return param && VALID_ROLES.includes(param) ? param : "PATIENT";
  });
  const theme = ROLE_THEMES[activeRole];

  return (
    <div className="flex min-h-screen bg-surface-light">
      {/* Left / Hero Brand Section — desktop only */}
      <div
        className={`hidden w-1/2 flex-col justify-between p-10 text-white transition-colors duration-300 ease-in-out lg:flex ${theme.heroBg}`}
      >
        <div>
          <Link to="/login" className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-sm font-bold">
              SC
            </span>
            Smart Clinic
          </Link>
        </div>

        <div className="space-y-8">
          {/* Active portal mode indicator */}
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold transition-colors duration-300 ease-in-out">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Chế độ {theme.portalLabel}
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">
              Nền Tảng Quản Lý
              <br />
              Phòng Khám Thông Minh
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-white/85">
              Tối ưu hóa quy trình tiếp đón bệnh nhân, hỗ trợ chẩn đoán lâm
              sàng, cấp phát thuốc và quản trị vận hành trên một nền tảng số
              hóa tập trung.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-white/85">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs font-medium text-white/60">
          &copy; {new Date().getFullYear()} Hệ Thống Quản Lý Phòng Khám Thông
          Minh. Bảo lưu mọi quyền.
        </p>
      </div>

      {/* Right / Form Section */}
      <div className="flex w-full flex-1 items-start justify-center p-6 sm:p-10 lg:items-center">
        <div className="w-full max-w-md py-4 lg:py-0">
          {/* Mobile-only brand */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-clinical-600 text-sm font-bold text-white">
              SC
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Smart Clinic
            </span>
          </div>

          <Outlet context={{ activeRole, setActiveRole, theme }} />
        </div>
      </div>
    </div>
  );
}