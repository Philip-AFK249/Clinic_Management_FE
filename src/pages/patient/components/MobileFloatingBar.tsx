import { Link } from "react-router-dom";
import { Calendar, Phone } from "lucide-react";

export default function MobileFloatingBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 block border-t border-slate-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm md:hidden">
      <div className="flex items-center gap-3">
        <a
          href="tel:1900 123 456"
          aria-label="Gọi phòng khám"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-clinical-600 transition-colors hover:bg-slate-50"
        >
          <Phone className="h-5 w-5" />
        </a>
        <Link
          to="/patient/booking"
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-cta text-base font-semibold text-white shadow-sm transition-colors hover:bg-cta-hover"
        >
          <Calendar className="h-4 w-4" />
          Đặt lịch khám ngay
        </Link>
      </div>
    </div>
  );
}