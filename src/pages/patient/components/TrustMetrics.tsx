import { TRUST_METRICS } from "../data/clinicContent";

export default function TrustMetrics() {
  return (
    <section className="border-y border-slate-200/80 bg-slate-50/70">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TRUST_METRICS.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="flex h-full items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clinical-50 text-clinical-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                    {metric.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
