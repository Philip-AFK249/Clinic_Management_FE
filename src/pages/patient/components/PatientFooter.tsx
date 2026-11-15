import { Link } from "react-router-dom";
import {
  Activity,
  BadgeCheck,
  Calendar,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";
import { CLINIC_SERVICES } from "../data/clinicContent";

const QUICK_LINKS = [
  { label: "Chuyên khoa", href: "#services" },
  { label: "Quy trình khám", href: "#quy-trinh" },
  { label: "Đội ngũ Bác sĩ", href: "#doctors" },
  { label: "Cơ sở phòng khám", href: "#locations" },
  { label: "Hỏi đáp", href: "#faq" },
];

export default function PatientFooter() {
  return (
    <footer className="border-t border-slate-200/80 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5 whitespace-nowrap">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-clinical-600 text-white shadow-sm">
                <Activity className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Smart Clinic
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Phòng khám số tập trung vào chăm sóc an toàn, dễ tiếp cận và bệnh
              án điện tử hoàn toàn không giấy.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5 text-clinical-600" aria-hidden="true" />
                ISO 27001
              </span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                <BadgeCheck className="h-3.5 w-3.5 text-clinical-600" aria-hidden="true" />
                HL7 FHIR R4
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Liên kết nhanh</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="transition-colors hover:text-clinical-700"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Chuyên khoa khám</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              {CLINIC_SERVICES.map((service) => (
                <li key={service.title}>
                  <a
                    href="#services"
                    className="transition-colors hover:text-clinical-700"
                  >
                    {service.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Cấp cứu &amp; Liên hệ</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a
                  href="tel:1900 123 456"
                  className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-clinical-300 hover:text-clinical-700"
                >
                  <PhoneCall className="h-4 w-4 text-clinical-600" aria-hidden="true" />
                  1900 123 456
                </a>
              </li>
              <li className="text-sm text-slate-500">T2 - CN: 07:30 - 20:30</li>
              <li className="text-sm leading-relaxed text-slate-500">
                Liên hệ qua tổng đài, cổng bệnh nhân hoặc trực tiếp tại bất kỳ
                cơ sở nào.
              </li>
            </ul>
            <Link
              to="/patient/booking"
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-cta px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cta-hover"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Đặt lịch khám ngay
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-200 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Hệ thống Quản lý Phòng khám Smart
            Clinic. Bảo lưu mọi quyền.
          </p>
          <p className="max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-right">
            Mạng lưới phòng khám được cấp phép &middot; Mã cơ sở KCB 12345
            &middot; Hạ tầng đạt chuẩn ISO 27001 &middot; Liên thông HL7 FHIR R4.
            Trường hợp khẩn cấp nguy hiểm tính mạng, vui lòng gọi cấp cứu 115.
          </p>
        </div>
      </div>
    </footer>
  );
}
