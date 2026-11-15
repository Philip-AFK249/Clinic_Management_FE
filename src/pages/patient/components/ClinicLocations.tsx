import { Clock, MapPin, Navigation, PhoneCall } from "lucide-react";
import { CLINIC_LOCATIONS } from "../data/clinicContent";

export default function ClinicLocations() {
  return (
    <section id="locations" className="scroll-mt-24 bg-slate-50/70 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-clinical-600">
            Cơ sở phòng khám
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Thăm Khám Thuận Tiện Gần Bạn
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-500">
            Thời gian chờ được cập nhật trực tiếp từ hệ thống kiosk để bạn chủ
            động sắp xếp thời gian đến.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {CLINIC_LOCATIONS.map((location) => (
            <div
              key={location.name}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clinical-50 text-clinical-600">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {location.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {location.address}
                    </p>
                  </div>
                </div>
                <a
                  href="#locations"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Chỉ đường
                </a>
              </div>

              {/* Live wait time */}
              <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-triage-p3/20 bg-triage-p3-bg px-3 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-triage-p3 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-triage-p3" />
                </span>
                <span className="text-xs font-semibold text-triage-p3">
                  Thời gian chờ hiện tại: {location.waitTime}
                </span>
              </div>

              {/* Transit & hours */}
              <ul className="mt-4 space-y-2">
                {location.transit.map((note) => {
                  const Icon = note.icon;
                  return (
                    <li
                      key={note.text}
                      className="flex items-center gap-2.5 text-sm text-slate-600"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                      {note.text}
                    </li>
                  );
                })}
                <li className="flex items-center gap-2.5 text-sm text-slate-600">
                  <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                  {location.hours}
                </li>
              </ul>

              {/* Contact */}
              <a
                href={`tel:${location.phone}`}
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-clinical-600 transition-colors hover:text-clinical-700"
              >
                <PhoneCall className="h-4 w-4" />
                {location.phone}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}