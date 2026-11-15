import { WORKFLOW_STEPS } from "../data/clinicContent";

export default function AiWorkflowSteps() {
  return (
    <section id="quy-trinh" className="scroll-mt-24 bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-clinical-600">
            Quy trình khám
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Bốn bước rõ ràng từ đặt lịch đến nhận đơn
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-500">
            Không giấy tờ, không cổng thông tin rối rắm - chỉ những bước ai cũng
            làm được.
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === WORKFLOW_STEPS.length - 1;
            return (
              <li
                key={step.title}
                className="relative flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
              >
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-6 top-11 hidden h-px w-6 bg-slate-200 lg:block"
                  />
                )}

                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-clinical-50 text-clinical-600">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-clinical-600 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                </div>

                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
