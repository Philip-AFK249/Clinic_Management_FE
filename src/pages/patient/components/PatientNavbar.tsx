import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  LogOut,
  MapPin,
  Menu,
  PhoneCall,
  X,
} from "lucide-react";
import { useAuth } from "../../../context/useAuth";

const NAV_LINKS = [
  { label: "Chuyên khoa", href: "#services" },
  { label: "Quy trình khám", href: "#quy-trinh" },
  { label: "Đội ngũ Bác sĩ", href: "#doctors" },
  { label: "Cơ sở phòng khám", href: "#locations" },
  { label: "Hỏi đáp", href: "#faq" },
];

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? "");
  const initials = letters.join("").toUpperCase();
  return initials.length > 0 ? initials : "BN";
}

export default function PatientNavbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHash, setActiveHash] = useState(
    () => window.location.hash,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function syncHash() {
      setActiveHash(window.location.hash);
    }
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

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
    setMobileOpen(false);
    logout();
    navigate("/");
  }

  return (
    <header>
      {/* Top Utility Bar */}
      <div className="hidden h-8 border-b border-slate-200/70 bg-slate-50/90 text-xs text-slate-600 md:block">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="tel:1900 123 456"
            className="inline-flex min-h-0 items-center gap-1.5 whitespace-nowrap transition-colors hover:text-sky-700"
          >
            <PhoneCall className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
            Cấp cứu &amp; Tư vấn:
            <span className="font-semibold text-slate-900">1900 123 456</span>
          </a>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              T2 - CN: 07:30 - 20:30
            </span>
            <span className="h-3.5 w-px bg-slate-200" aria-hidden="true" />
            <button
              type="button"
              className="inline-flex min-h-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 font-medium transition-colors hover:bg-slate-200/60 hover:text-sky-700"
            >
              <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              Cơ sở Cầu Giấy (Hà Nội)
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Sticky Navbar */}
      <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 xl:gap-6">
          {/* Brand */}
          <Link to="/" className="inline-flex min-h-0 shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-blue-700 text-white shadow-sm">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="whitespace-nowrap text-[17px] font-bold tracking-tight text-slate-900">
              Smart Clinic
            </span>
          </Link>

          {/* Center navigation */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden items-center gap-0.5 lg:flex xl:gap-1"
          >
            {NAV_LINKS.map((link) => {
              const active = activeHash === link.href;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setActiveHash(link.href)}
                  className={`inline-flex h-9 min-h-0 items-center rounded-lg px-2 text-[13.5px] xl:px-3 font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-sky-50 font-semibold text-sky-700"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-sky-700"
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          {/* Right-side actions */}
          <div className="flex shrink-0 items-center gap-2.5">
            {isAuthenticated ? (
              <div ref={menuRef} className="relative hidden lg:block">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={user?.fullName || "Tài khoản bệnh nhân"}
                  onClick={() => setMenuOpen((open) => !open)}
                  className="inline-flex h-9 min-h-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 text-[13px] font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[11px] font-bold text-white">
                    {initialsOf(user?.fullName || "BN")}
                  </span>
                  <span className="hidden max-w-[140px] truncate xl:inline-block">
                    {user?.fullName || "Bệnh nhân"}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
                      menuOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
                  >
                    <div className="border-b border-slate-100 px-3 py-2.5">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {user?.fullName}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {user?.email}
                      </p>
                    </div>

                    <Link
                      to="/patient/dashboard"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-sky-700"
                    >
                      <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      Lịch hẹn &amp; Xếp hàng
                    </Link>

                    <Link
                      to="/patient/profile"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-sky-700"
                    >
                      <FileText className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      Hồ sơ sức khỏe (EHR)
                    </Link>

                    <Link
                      to="/patient/profile"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-sky-700"
                    >
                      <CreditCard className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      Thông tin cá nhân &amp; BHYT
                    </Link>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
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
                className="hidden h-9 min-h-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 xl:px-3.5 text-[13px] font-semibold whitespace-nowrap text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 lg:inline-flex"
              >
                Đăng nhập
              </Link>
            )}

            <Link
              to="/patient/booking"
              className="hidden h-9 min-h-0 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3.5 xl:px-4 text-[13px] font-semibold whitespace-nowrap text-white shadow-sm shadow-sky-600/20 transition-all hover:bg-sky-700 sm:inline-flex"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Đặt lịch khám ngay
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
              aria-expanded={mobileOpen}
              className="inline-flex h-9 min-h-0 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 lg:hidden"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="border-t border-slate-200/80 bg-white lg:hidden">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
              <nav aria-label="Điều hướng di động" className="grid gap-1">
                {NAV_LINKS.map((link) => {
                  const active = activeHash === link.href;
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        setActiveHash(link.href);
                        setMobileOpen(false);
                      }}
                      className={`flex h-10 min-h-0 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                        active
                          ? "bg-sky-50 font-semibold text-sky-700"
                          : "text-slate-700 hover:bg-slate-50 hover:text-sky-700"
                      }`}
                    >
                      {link.label}
                    </a>
                  );
                })}
              </nav>

              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                {isAuthenticated ? (
                  <>
                    <div className="px-3 pb-1.5">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {user?.fullName || "Bệnh nhân"}
                      </p>
                      <p className="truncate text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <Link
                      to="/patient/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-sky-700"
                    >
                      <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      Lịch hẹn &amp; Xếp hàng
                    </Link>
                    <Link
                      to="/patient/profile"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-sky-700"
                    >
                      <FileText className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      Hồ sơ sức khỏe (EHR)
                    </Link>
                    <Link
                      to="/patient/profile"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-sky-700"
                    >
                      <CreditCard className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      Thông tin cá nhân &amp; BHYT
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Đăng xuất
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login?role=PATIENT"
                    onClick={() => setMobileOpen(false)}
                    className="flex h-10 min-h-0 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Đăng nhập Cổng Bệnh nhân
                  </Link>
                )}
              </div>

              <Link
                to="/patient/booking"
                onClick={() => setMobileOpen(false)}
                className="mt-3 flex h-10 min-h-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm shadow-sky-600/20 transition-colors hover:bg-sky-700"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Đặt lịch khám ngay
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
