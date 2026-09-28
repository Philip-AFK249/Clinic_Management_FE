import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Building2,
  LayoutGrid,
  MonitorSmartphone,
  Pill,
  Stethoscope,
  UserCog,
  X,
} from "lucide-react";

interface PortalTarget {
  path: string;
  label: string;
  icon: typeof Stethoscope;
  accent: string;
}

const PORTALS: PortalTarget[] = [
  {
    path: "/doctor/ehr",
    label: "Bác sĩ",
    icon: Stethoscope,
    accent: "hover:bg-teal-50 hover:text-teal-700",
  },
  {
    path: "/reception",
    label: "Tiếp đón",
    icon: Building2,
    accent: "hover:bg-clinical-50 hover:text-clinical-700",
  },
  {
    path: "/kiosk",
    label: "Kiosk",
    icon: MonitorSmartphone,
    accent: "hover:bg-clinical-50 hover:text-clinical-700",
  },
  {
    path: "/pharmacy/queue",
    label: "Dược",
    icon: Pill,
    accent: "hover:bg-emerald-50 hover:text-emerald-700",
  },
  {
    path: "/admin/overview",
    label: "Admin",
    icon: UserCog,
    accent: "hover:bg-slate-100 hover:text-slate-900",
  },
];

function isActivePath(current: string, target: string): boolean {
  if (target === "/doctor/ehr") return current === "/doctor/ehr" || current === "/doctor";
  if (target === "/admin/overview")
    return current === "/admin" || current.startsWith("/admin");
  return current === target;
}

interface PortalSwitcherProps {
  /** Rendered inline as a row of links instead of a popover. */
  variant?: "popover" | "inline";
}

/**
 * Demo switcher that jumps between the staff portals. Each portal owns its own
 * header, so this is the one shared navigation affordance in the app.
 */
export default function PortalSwitcher({ variant = "popover" }: PortalSwitcherProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (variant === "inline") {
    return (
      <nav
        aria-label="Chuyển nhanh giữa các cổng"
        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
      >
        {PORTALS.map((portal) => {
          const active = isActivePath(location.pathname, portal.path);
          const Icon = portal.icon;
          return (
            <Link
              key={portal.path}
              to={portal.path}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold transition-colors ${
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : `text-slate-500 ${portal.accent}`
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {portal.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  const current = PORTALS.find((portal) =>
    isActivePath(location.pathname, portal.path),
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden lg:inline">
          {current ? current.label : "Cổng khác"}
        </span>
        {open && <X className="h-3 w-3" aria-hidden="true" />}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Đóng menu chuyển cổng"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-11 z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-elevated"
          >
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Chuyển nhanh demo
            </p>
            {PORTALS.map((portal) => {
              const active = isActivePath(location.pathname, portal.path);
              const Icon = portal.icon;
              return (
                <Link
                  key={portal.path}
                  to={portal.path}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-9 items-center gap-2 px-3 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-slate-900 text-white"
                      : `text-slate-700 ${portal.accent}`
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {portal.label}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
