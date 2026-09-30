import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  LogOut,
  MapPin,
  PhoneCall,
  QrCode,
} from "lucide-react";
import { useAuth } from "../../../context/useAuth";

const NAV_LINKS = [
  { label: "Chuyên khoa", href: "#services" },
  { label: "Quy trình khám", href: "#how-it-works" },
  { label: "Đội ngũ Bác sĩ", href: "#doctors" },
  { label: "Cơ sở phòng khám", href: "#locations" },
  { label: "Hỏi đáp FAQ", href: "#faq" },
];

/**
 * Up to two initials from a full name, for the avatar chip.
 *
 * Vietnamese names are space separated with the given name last, so the leading
 * words are the ones that identify the patient in a list.
 */
function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? "");
  const initials = letters.join("").toUpperCase();
  return initials.length > 0 ? initials : "BN";
}

export default function PatientNavbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate("/");
  }

  return (
    <header>
      {/* Top Utility Strip */}
      <div className="hidden border-b border-slate-200/80 bg-slate-100 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-[13px] text-slate-700 sm:px-6 lg:px-8">
          <a
            href="tel:1900 123 456"
            className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-clinical-700"
          >
            <PhoneCall className="h-3.5 w-3.5 text-clinical-600" />
            Cấp cứu &amp; Tư vấn: 1900 123 456
          </a>
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              T2 - CN: 07:30 - 20:30
            </span>
            <span className="h-4 w-px bg-slate-300" />
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium transition-colors hover:text-clinical-700"
            >
              <MapPin className="h-3.5 w-3.5 text-slate-500" />
              Cơ sở Cầu Giấy (Hà Nội)
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Nav Bar */}
      <nav className="sticky top-0 z-40 border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-clinical-600 text-white">
              <Activity className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Smart Clinic
            </span>
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition-colors hover:text-clinical-700"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/patient/dashboard"
              className="hidden h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:text-clinical-700 md:inline-flex"
            >
              <QrCode className="h-4 w-4 text-clinical-600" aria-hidden="true" />
              Vé của tôi
            </Link>
            {isAuthenticated ? (
              <div ref={menuRef} className="relative hidden md:block">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-clinical-100 text-xs font-bold text-clinical-700">
                    {initialsOf(user?.fullName || "BN")}
                  </span>
                  <span className="max-w-[130px] truncate font-medium text-slate-800">
                    {user?.fullName || "Bệnh nhân"}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                      menuOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-11 z-50 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-elevated"
                  >
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {user?.fullName}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {user?.email}
                      </p>
                    </div>

                    <Link
                      to="/patient/profile"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-clinical-600"
                    >
                      <CreditCard className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      Hồ sơ cá nhân &amp; Thẻ BHYT
                    </Link>

                    <Link
                      to="/patient/dashboard"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-clinical-600"
                    >
                      <FileText className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      Phiếu khám &amp; Hàng đợi của tôi
                    </Link>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login?role=PATIENT"
                className="hidden h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 md:inline-flex"
              >
                Cổng Bệnh nhân (Đăng nhập)
              </Link>
            )}
            <Link
              to="/patient/booking"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-cta px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-cta-hover"
            >
              Đặt lịch khám ngay
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}