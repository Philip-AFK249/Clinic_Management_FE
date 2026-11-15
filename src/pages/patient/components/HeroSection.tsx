import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  FileText,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../../context/useAuth";
import { HERO_CONSULTATION_IMAGE } from "../data/clinicContent";

export default function HeroSection() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="bg-white pt-10 pb-16 lg:py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div className="lg:col-span-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-clinical-200 bg-clinical-50 px-3.5 py-1.5 text-xs font-semibold text-clinical-700 sm:text-sm">
            <ShieldCheck className="h-4 w-4 shrink-0 text-clinical-600" aria-hidden="true" />
            Chuẩn HL7 FHIR &middot; Bảo mật ISO 27001
          </span>

          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Đặt lịch khám nhanh,{" "}
            <span className="text-clinical-600">an tâm chăm sóc sức khỏe.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Đặt lịch khám trong vài phút, phân luồng triệu chứng bằng AI và hỗ trợ
            BHYT ngay trên một nền tảng số duy nhất.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/patient/booking"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-cta px-6 text-base font-semibold text-white shadow-md transition-all hover:bg-cta-hover"
            >
              <Calendar className="h-5 w-5" aria-hidden="true" />
              Đặt lịch khám ngay
            </Link>
            {isAuthenticated ? (
              <Link
                to="/patient/dashboard"
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-6 text-base font-semibold text-slate-700 transition-colors hover:border-clinical-300 hover:text-clinical-700"
              >
                <FileText className="h-5 w-5 text-clinical-600" aria-hidden="true" />
                Hồ sơ sức khỏe &amp; Lịch khám
              </Link>
            ) : (
              <a
                href="#quy-trinh"
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-6 text-base font-semibold text-slate-700 transition-colors hover:border-clinical-300 hover:text-clinical-700"
              >
                Xem quy trình khám
                <ArrowRight className="h-5 w-5 text-clinical-600" aria-hidden="true" />
              </a>
            )}
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Không cần thanh toán trước &middot; Hỗ trợ BHYT &middot; Tiếp nhận bệnh
            nhân vãng lai
          </p>

          <a
            href="tel:1900 123 456"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-clinical-700"
          >
            <PhoneCall className="h-4 w-4 text-clinical-600" aria-hidden="true" />
            Hỗ trợ đặt lịch: 1900 123 456
          </a>
        </div>

        <div className="lg:col-span-5">
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div
              className="absolute -inset-3 rounded-[2rem] bg-clinical-50/80"
              aria-hidden="true"
            />
            <div
              className={`relative overflow-hidden rounded-3xl border border-slate-200/80 shadow-elevated ${HERO_CONSULTATION_IMAGE.aspect}`}
            >
              <img
                src={HERO_CONSULTATION_IMAGE.url}
                alt={HERO_CONSULTATION_IMAGE.alt}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-triage-p3 opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-triage-p3" />
                  </span>
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Thời gian chờ trung bình
                    </p>
                    <p className="text-sm font-bold text-slate-900">
                      ~5 phút từ Kiosk đến phòng khám
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
