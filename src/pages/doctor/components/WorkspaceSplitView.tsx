import { useEffect, useState, type ReactNode } from "react";
import { ClipboardList, Stethoscope } from "lucide-react";

/** The two phone-sized slices of the consultation workspace. */
export type WorkspaceMobileTab = "notes" | "review";

interface WorkspaceSplitViewProps {
  /** Desktop-only: live transcript. */
  left: ReactNode;
  /** Desktop-only: the full editor (tree + SOAP + ICD + prescription). */
  right: ReactNode;
  /** Mobile tab 1: decision tree + SOAP notes. */
  mobileNotes: ReactNode;
  /** Mobile tab 2: selected diagnoses + prescription. */
  mobileReview: ReactNode;
  mobileTab: WorkspaceMobileTab;
  onMobileTabChange: (tab: WorkspaceMobileTab) => void;
}

const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Mirrors the `lg` breakpoint in JS so the mobile tab bar only mounts the tab
 * the doctor can actually see. Rendering both editors and hiding one with CSS
 * would duplicate their seeding effects and state.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}

const TABS: {
  id: WorkspaceMobileTab;
  label: string;
  icon: typeof Stethoscope;
}[] = [
  { id: "notes", label: "Khám & Chọn nhanh", icon: Stethoscope },
  { id: "review", label: "Chẩn đoán & Đơn thuốc", icon: ClipboardList },
];

export default function WorkspaceSplitView({
  left,
  right,
  mobileNotes,
  mobileReview,
  mobileTab,
  onMobileTabChange,
}: WorkspaceSplitViewProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-5">
        <section className="col-span-2 flex min-h-0 min-w-0 flex-col border-r border-slate-200/80 bg-white">
          {left}
        </section>
        <section className="col-span-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-surface-light">
          {right}
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Sticky segmented control: the doctor switches context, not scrolls. */}
      <div className="sticky top-0 z-30 flex shrink-0 gap-1 border-b border-slate-200/80 bg-white/95 px-2 py-1.5 backdrop-blur">
        {TABS.map((tab) => {
          const active = mobileTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onMobileTabChange(tab.id)}
              aria-pressed={active}
              className={`inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-bold leading-tight transition-colors ${
                active
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-light">
        {mobileTab === "notes" ? mobileNotes : mobileReview}
      </div>
    </div>
  );
}
