import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarX,
  CheckCircle2,
  Clock,
  FileText,
  QrCode,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/useAuth";
import PatientNavbar from "./components/PatientNavbar";
import PatientFooter from "./components/PatientFooter";
import { PAST_ENCOUNTERS, QUEUE_SNAPSHOT } from "./data/patientMockRecords";
import { readActiveBooking } from "./data/activeBooking";

type DashboardTab = "queue" | "records";

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<DashboardTab>("queue");
  const [serving, setServing] = useState(QUEUE_SNAPSHOT.currentServing);
  // Read once on mount: the route unmounts between visits, so a booking made on
  // /patient/booking is picked up the next time the dashboard is opened.
  const [activeBooking] = useState(readActiveBooking);

  useEffect(() => {
    if (serving === QUEUE_SNAPSHOT.yourTicket) return;
    const handle = window.setTimeout(
      () => setServing(QUEUE_SNAPSHOT.yourTicket),
      6000,
    );
    return () => window.clearTimeout(handle);
  }, [serving]);

  const yourTurn = serving === QUEUE_SNAPSHOT.yourTicket;
  const personsAhead = yourTurn ? 0 : QUEUE_SNAPSHOT.personsAhead;

  function handleDownload(receipt: string) {
    toast.info(
      `e-Prescription ${receipt} đã được tạo (PDF). Kiểm tra hộp thư hoặc ứng dụng di động của bạn.`,
      { duration: 4000 },
    );
  }

  return (
    <div className="min-h-screen bg-surface-light text-slate-900">
      <PatientNavbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-clinical-600">
            Cổng Bệnh nhân
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Xin chào, {user?.fullName || "Quý khách"}
          </h1>
          <p className="text-base text-slate-500">
            Theo dõi lượt khám trực tiếp và truy cập hồ sơ sức khỏe điện tử của
            bạn.
          </p>
        </div>

        {/* Tab switcher */}
        <div
          role="tablist"
          aria-label="Các mục của cổng bệnh nhân"
          className="mt-6 flex flex-wrap gap-2"
        >
          {(
            [
              { key: "queue", label: "Lịch hẹn & Xếp hàng trực tiếp" },
              { key: "records", label: "Hồ sơ sức khỏe điện tử (EHR)" },
            ] as { key: DashboardTab; label: string }[]
          ).map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.key)}
                className={`inline-flex h-12 items-center gap-2 rounded-full border px-5 text-base font-medium transition-colors ${
                  active
                    ? "border-clinical-600 bg-clinical-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-clinical-300 hover:text-clinical-700"
                }`}
              >
                {item.key === "queue" ? (
                  <Clock className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden="true" />
                )}
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "queue" ? (
          activeBooking ? (
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {/* Active appointment */}
              <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Lịch hẹn đang hoạt động
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Đã xác nhận
                  </span>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <Row label="Mã phiếu khám" value={activeBooking.ticketCode} bold />
                  <Row
                    label="Ngày & Giờ"
                    value={`${activeBooking.date}, ${activeBooking.timeSlot}`}
                  />
                  <Row label="Chuyên khoa" value={activeBooking.department} />
                  <Row label="Bác sĩ" value={activeBooking.doctor} />
                  <Row label="Phòng khám" value={activeBooking.room} />
                </dl>
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-clinical-100 bg-clinical-50 p-3">
                  <QrCode
                    className="h-5 w-5 shrink-0 text-clinical-600"
                    aria-hidden="true"
                  />
                  <p className="text-sm leading-relaxed text-slate-600">
                    Xuất trình vé QR check-in tại kiosk cửa vào để lấy số thứ tự
                    nhanh.
                  </p>
                </div>
              </section>

              {/* Live queue tracker */}
              <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Theo dõi hàng đợi trực tiếp
                  </p>
                  <span className="text-xs font-medium text-slate-400">
                    Cập nhật tự động mỗi vài giây
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <QueueRow
                    label="Đang phục vụ"
                    value={serving}
                    active
                    detail="Đang được tư vấn"
                  />
                  <QueueRow
                    label="Vé của bạn"
                    value={QUEUE_SNAPSHOT.yourTicket}
                    highlight
                    detail={
                      yourTurn
                        ? "Đến lượt của bạn - vui lòng đến phòng khám"
                        : `${personsAhead} người trước bạn, ước tính ~${QUEUE_SNAPSHOT.estimateMinutes} phút`
                    }
                  />
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-clinical-600 text-white">
                      <Users className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="text-sm">
                      <p className="font-semibold text-slate-900">{activeBooking.room}</p>
                      <p className="text-slate-500">
                        Bác sĩ sẵn sàng tiếp đón bạn ngay sau đây.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <section className="mt-8 rounded-xl border border-slate-200/80 bg-white p-10 text-center shadow-card">
              <CalendarX size={32} className="mx-auto text-slate-300" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold text-slate-900">
                Bạn chưa có lịch hẹn khám nào
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                Chủ động đặt lịch khám trước để chọn chuyên khoa, khung giờ phù
                hợp và giảm thời gian chờ đợi tại phòng khám.
              </p>
              <Link
                to="/patient/booking"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-clinical-600 px-6 text-sm font-semibold text-white shadow-card transition-colors hover:bg-clinical-700"
              >
                Đặt lịch khám ngay
              </Link>
            </section>
          )
        ) : (
          <div className="mt-8 space-y-5">
            {PAST_ENCOUNTERS.map((encounter) => (
              <article
                key={encounter.id}
                className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      Khám ngày {encounter.date}{" "}
                      <span className="font-medium text-slate-500">
                        &middot; {encounter.department}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {encounter.physician}
                    </p>
                  </div>
                  <span className="rounded-full border border-clinical-200 bg-clinical-50 px-3 py-1 text-xs font-semibold text-clinical-700">
                    {encounter.diagnosis}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {encounter.notes}
                </p>

                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Thuốc</th>
                        <th className="px-3 py-2">Liều dùng</th>
                        <th className="px-3 py-2">Tần suất</th>
                        <th className="px-3 py-2">SL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {encounter.prescriptions.map((prescription) => (
                        <tr
                          key={prescription.medication}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-3 py-2 font-semibold text-slate-900">
                            {prescription.medication}
                            {prescription.note && (
                              <span className="block text-xs font-normal text-slate-500">
                                {prescription.note}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {prescription.dosage}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {prescription.frequency}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {prescription.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    Hóa đơn phát thuốc:{" "}
                    <span className="font-mono font-medium text-slate-600">
                      {encounter.pharmacyReceipt}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDownload(encounter.pharmacyReceipt)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-clinical-400 hover:text-clinical-700"
                  >
                    <FileText className="h-4 w-4 text-clinical-600" aria-hidden="true" />
                    Tải đơn thuốc điện tử
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <PatientFooter />
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={bold ? "font-bold text-slate-900" : "font-medium text-slate-900"}>
        {value}
      </dd>
    </div>
  );
}

function QueueRow({
  label,
  value,
  active = false,
  highlight = false,
  detail,
}: {
  label: string;
  value: string;
  active?: boolean;
  highlight?: boolean;
  detail: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
        active
          ? "border-teal-200 bg-teal-50"
          : highlight
            ? "border-clinical-200 bg-clinical-50"
            : "border-slate-200 bg-slate-50"
      }`}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p
          className={`text-base font-bold ${active ? "text-teal-700" : highlight ? "text-clinical-700" : "text-slate-900"}`}
        >
          {value}
        </p>
      </div>
      <p
        className={`text-right text-xs font-medium ${
          active ? "text-teal-800" : "text-slate-500"
        }`}
      >
        {detail}
        {active && (
          <span
            className="ml-1 inline-block h-2 w-2 rounded-full bg-teal-500"
            aria-hidden="true"
          />
        )}
      </p>
    </div>
  );
}