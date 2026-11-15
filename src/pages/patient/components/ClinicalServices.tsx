import { Link } from "react-router-dom";
import { ArrowRight, Microscope, Stethoscope, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CoreDepartment {
  title: string;
  description: string;
  highlights: string[];
  icon: LucideIcon;
  iconClassName: string;
  accentClassName: string;
}

const CORE_DEPARTMENTS: CoreDepartment[] = [
  {
    title: "Khoa Nội Tổng quát & Tim mạch",
    description:
      "Tầm soát và điều trị các bệnh lý nội khoa, tim mạch và chuyển hóa trong một quy trình liền mạch.",
    highlights: [
      "Tăng huyết áp, đái tháo đường, rối loạn mỡ máu",
      "Tầm soát sức khỏe tổng quát và tư vấn dự phòng",
    ],
    icon: Stethoscope,
    iconClassName: "bg-clinical-50 text-clinical-600",
    accentClassName: "text-clinical-600",
  },
  {
    title: "Khoa Hô hấp & Dị ứng - Miễn dịch",
    description:
      "Chẩn đoán chính xác các bệnh lý hô hấp và dị ứng bằng xét nghiệm chuyên sâu, phác đồ cá nhân hóa.",
    highlights: [
      "Hen suyễn, viêm mũi dị ứng, mề đay mạn tính",
      "Test lẩy da và tư vấn kiểm soát dị nguyên",
    ],
    icon: Wind,
    iconClassName: "bg-emerald-50 text-emerald-600",
    accentClassName: "text-emerald-600",
  },
  {
    title: "Khoa Da liễu",
    description:
      "Thăm khám da liễu nhẹ nhàng với hỗ trợ soi da kỹ thuật số, phù hợp cho cả người lớn và trẻ em.",
    highlights: [
      "Viêm da cơ địa, chàm, mụn, nấm da",
      "Soi da Dermoscopy và tư vấn chăm sóc phục hồi",
    ],
    icon: Microscope,
    iconClassName: "bg-violet-50 text-violet-600",
    accentClassName: "text-violet-600",
  },
];

export default function ClinicalServices() {
  return (
    <section id="services" className="scroll-mt-24 bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-clinical-600">
            Chuyên khoa khám
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Ba chuyên khoa trọng tâm, một trải nghiệm liền mạch
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-500">
            Mỗi chuyên khoa được thiết kế để bạn được đánh giá đúng vấn đề, đúng
            bác sĩ và đúng thời điểm.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {CORE_DEPARTMENTS.map((department) => {
            const Icon = department.icon;
            return (
              <article
                key={department.title}
                className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-clinical-300 hover:shadow-md"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${department.iconClassName}`}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {department.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {department.description}
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {department.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex items-start gap-2 text-sm leading-relaxed text-slate-600"
                    >
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          department.accentClassName
                        } bg-current`}
                        aria-hidden="true"
                      />
                      {highlight}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/patient/booking"
                  className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ${department.accentClassName} transition-colors hover:opacity-80`}
                >
                  Đặt khám chuyên khoa
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
