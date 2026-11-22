import { useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Mail, MapPin, Phone } from "lucide-react";
import { MEDICAL_STAFF } from "../data/clinicContent";
import type { StaffMember } from "../data/clinicContent";

type RoleFilter = "ALL" | "DOCTOR" | "NURSE";

const FILTERS: { key: RoleFilter; label: string }[] = [
  { key: "ALL", label: "Toàn đội ngũ" },
  { key: "DOCTOR", label: "Bác sĩ chuyên khoa" },
  { key: "NURSE", label: "Y tá / Thư ký y khoa" },
];

export default function MedicalStaffSection() {
  const [activeFilter, setActiveFilter] = useState<RoleFilter>("ALL");

  const filteredStaff =
    activeFilter === "ALL"
      ? MEDICAL_STAFF
      : MEDICAL_STAFF.filter((staff) => staff.role === activeFilter);

  return (
    <section id="doctors" className="scroll-mt-24 bg-slate-50/70 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-clinical-600">
            Đội ngũ y bác sĩ
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Gặp Gỡ Đội Ngũ Chăm Sóc
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Đội ngũ bác sĩ và y tá / thư ký y khoa, sẵn sàng hỗ trợ
            bạn hôm nay với quy trình khám chuẩn hóa và lịch khám linh hoạt.
          </p>
        </div>

        {/* Role filter tabs */}
        <div
          role="tablist"
          aria-label="Filter care team by role"
          className="mt-8 flex flex-wrap gap-2"
        >
          {FILTERS.map((filter) => {
            const count =
              filter.key === "ALL"
                ? MEDICAL_STAFF.length
                : MEDICAL_STAFF.filter((staff) => staff.role === filter.key)
                    .length;
            const active = activeFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveFilter(filter.key)}
                className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
                  active
                    ? "border-clinical-600 bg-clinical-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-clinical-300 hover:text-clinical-700"
                }`}
              >
                {filter.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Staff cards */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filteredStaff.map((staff) => (
            <StaffCard key={staff.id} staff={staff} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StaffCard({ staff }: { staff: StaffMember }) {
  const isDoctor = staff.role === "DOCTOR";

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:shadow-md">
      {/* Header image & badges */}
      <div className="relative aspect-[4/5] w-full">
        <img
          src={staff.imageUrl}
          alt={`${staff.name}, ${staff.title}`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${
            isDoctor ? "bg-clinical-600" : "bg-teal-600"
          }`}
        >
          {isDoctor ? "Bác sĩ" : "Y tá / Thư ký y khoa"}
        </span>
        {staff.availableToday && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-2.5 py-0.5 text-xs font-medium text-emerald-700 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Nhận khám hôm nay
          </span>
        )}
      </div>

      {/* Demographics & medical specialty */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug text-slate-900">
          {staff.name}
        </h3>
        <p className="mt-0.5 text-sm font-medium text-slate-500">
          {staff.title}
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs font-medium text-slate-500">
          <span>Tuổi: {staff.age}</span>
          <span aria-hidden="true">&bull;</span>
          <span>{staff.experienceYears} năm kinh nghiệm</span>
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-clinical-600">
          {staff.department}
        </p>
        <span className="mt-2 inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
          {staff.specialty}
        </span>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-clinical-600" />
          {staff.roomNumber}
        </p>

        {/* Interactive contact strip */}
        <div className="mt-auto space-y-2 border-t border-slate-200/80 pt-3">
          <a
            href={`tel:${staff.phone}`}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-700 transition-colors hover:text-clinical-600"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-clinical-600" aria-hidden="true" />
            <span className="truncate">{staff.phone}</span>
            <span className="shrink-0 text-slate-400">({staff.extension})</span>
          </a>
          <a
            href={`mailto:${staff.email}`}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-700 transition-colors hover:text-clinical-600"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-clinical-600" aria-hidden="true" />
            <span className="truncate">{staff.email}</span>
          </a>
        </div>

        {/* Card footer action */}
        {isDoctor ? (
          <Link
            to={`/patient/booking?doctorId=${staff.id}`}
            className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cta px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cta-hover"
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            Đặt lịch khám
          </Link>
        ) : (
          <a
            href={`tel:${staff.phone}`}
            className="mt-4 flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
          >
            <Phone className="h-3.5 w-3.5 text-clinical-600" aria-hidden="true" />
            Liên hệ trực tiếp
          </a>
        )}
      </div>
    </article>
  );
}