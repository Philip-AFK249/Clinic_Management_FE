import { useEffect, useState } from "react";
import { RotateCcw, Volume2, X } from "lucide-react";
import PortalSwitcher from "../../../components/PortalSwitcher";

interface KioskHeaderProps {
  onReset: () => void;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const time = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const weekday = now.toLocaleDateString("vi-VN", { weekday: "long" });
  const date = now.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return { time, weekday, date };
}

export default function KioskHeader({ onReset }: KioskHeaderProps) {
  const { time, weekday, date } = useClock();

  return (
    <header className="shrink-0 border-b border-slate-200/80 bg-white px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-clinical-600 text-white">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21s-6-4.35-6-9a6 6 0 1 1 12 0c0 4.65-6 9-6 9z"
              />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          </span>
          <div>
            <p className="text-base font-bold leading-tight text-slate-900">
              Smart Clinic{" "}
              <span className="ml-1 rounded-md bg-clinical-50 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-clinical-700">
                Kiosk Tiếp Đón &amp; Phân Luồng Tự Động
              </span>
            </p>
            <p className="text-sm text-slate-500">Kiosk #01 - Sảnh A</p>
          </div>
        </div>

        {/* Clock */}
        <div className="text-center">
          <p className="font-mono text-3xl font-bold tabular-nums tracking-tight text-slate-900">
            {time}
          </p>
          <p className="text-xs font-medium capitalize text-slate-500">
            {weekday}, {date}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <PortalSwitcher />
          <span className="hidden items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 animate-pulse xl:inline-flex">
            🚨 Cấp Cứu Khẩn Cấp: Gọi 115 hoặc Bấm Chuông Quầy
          </span>
          <button
            type="button"
            aria-label="Điều chỉnh âm lượng"
            className="inline-flex h-14 w-14 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-600 transition-transform active:scale-95"
          >
            <Volume2 className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-transform active:scale-95"
          >
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
            Bắt đầu lại
          </button>
          <button
            type="button"
            aria-label="Đóng"
            className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-transform active:scale-95"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}