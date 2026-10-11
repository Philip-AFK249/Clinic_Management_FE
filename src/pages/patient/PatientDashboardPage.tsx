import { useState } from "react";
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
import type { QueueStatus } from "../../services/intakeApi";
import PatientNavbar from "./components/PatientNavbar";
import PatientFooter from "./components/PatientFooter";
import { PAST_ENCOUNTERS } from "./data/patientMockRecords";
import { readActiveBooking } from "./data/activeBooking";
import { usePatientTicket } from "./hooks/usePatientTicket";

type DashboardTab = "queue" | "records";

/** `yyyy-MM-dd` (what the intake service stores) as the `dd/MM/yyyy` we print. */
function dateLabelFrom(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * Queue status as the patient should read it.
 *
 * Every state the backend can report is listed, including the two terminal
 * ones the live poll can still return via the stored ticket number - a screen
 * that blanks out because a visit ended would look like an outage.
 */
const STATUS_BADGES: Record<
  QueueStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  WAITING: {
    label: "Đang chờ tiếp đón",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock,
  },
  CALLED: {
    label: "Đã được gọi",
    className: "border-clinical-200 bg-clinical-50 text-clinical-700",
    icon: CheckCircle2,
  },
  IN_CONSULTATION: {
    label: "Đang khám",
    className: "border-teal-200 bg-teal-50 text-teal-700",
    icon: CheckCircle2,
  },
  COMPLETED: {
    label: "Đã hoàn tất khám",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  SKIPPED: {
    label: "Đã bỏ lỡ",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: Clock,
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: Clock,
  },
};

const FINISHED_NOTICES: Record<QueueStatus, string> = {
  COMPLETED:
    "Phiếu khám của bạn đã hoàn tất. Kết quả và đơn thuốc (nếu có) sẽ xuất hiện trong tab Hồ sơ sức khỏe điện tử.",
  SKIPPED:
    "Phiếu khám đã bị bỏ qua do không có mặt khi được gọi. Vui lòng liên hệ quầy tiếp đón để được xếp lại lịch.",
  CANCELLED:
    "Phiếu khám đã bị hủy. Bạn có thể đặt một lịch hẹn mới bất cứ lúc nào.",
  WAITING: "",
  CALLED: "",
  IN_CONSULTATION: "",
};

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<DashboardTab>("queue");
  // Read once on mount: the route unmounts between visits, so a booking made on
  // /patient/booking is picked up the next time the dashboard is opened.
  // `readActiveBooking` itself purges anything the backend could not have
  // minted (e.g. the legacy mock `#APT-2026-8821`).
  const [storedBooking] = useState(readActiveBooking);
  // Live view of that booking: the stored record seeds the screen immediately,
  // and the hook overwrites it with the backend's answer as soon as one lands.
  const ticket = usePatientTicket(storedBooking);
  // A booking the backend rejects as unknown (400/404) is dropped by the hook;
  // from the page's point of view the patient simply has no appointment left.
  const activeBooking = ticket.invalidTicket ? null : storedBooking;

  function handleDownload(receipt: string) {
    toast.info(
      `e-Prescription ${receipt} đã được tạo (PDF). Kiểm tra hộp thư hoặc ứng dụng di động của bạn.`,
      { duration: 4000 },
    );
  }

  // The stored booking renders on its own while the first poll is in flight;
  // once it answers, the backend's copy wins everywhere it has an opinion.
  const display = {
    ticketCode: ticket.detail?.ticketNumber ?? activeBooking?.ticketCode ?? "",
    patientName: ticket.detail?.patientFullName ?? activeBooking?.patientName ?? "",
    department: ticket.detail?.departmentName ?? activeBooking?.department ?? "",
    doctor: ticket.detail?.doctorName ?? activeBooking?.doctor ?? "",
    room: ticket.detail?.roomNumber ?? activeBooking?.room ?? "",
    date: ticket.detail
      ? dateLabelFrom(ticket.detail.appointmentDate)
      : activeBooking?.date ?? "",
    timeSlot: ticket.detail
      ? ticket.detail.slotStartTime.slice(0, 5)
      : activeBooking?.timeSlot ?? "",
  };
  const statusBadge = STATUS_BADGES[ticket.status];

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
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadge.className}`}
                  >
                    <statusBadge.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {statusBadge.label}
                  </span>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <Row label="Mã phiếu khám" value={display.ticketCode} bold />
                  <Row
                    label="Ngày & Giờ"
                    value={`${display.date}, ${display.timeSlot}`}
                  />
                  <Row label="Chuyên khoa" value={display.department} />
                  <Row label="Bác sĩ" value={display.doctor} />
                  <Row label="Phòng khám" value={display.room} />
                </dl>
                {ticket.isActive && (
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
                )}
                {ticket.isOffline && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm leading-relaxed text-amber-800">
                      {ticket.error ||
                        "Không kết nối được dịch vụ hàng đợi. Đang hiển thị thông tin xác nhận lúc đặt lịch."}
                    </p>
                  </div>
                )}
              </section>

              {ticket.isActive ? (
                /* Live queue tracker */
                <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Theo dõi hàng đợi trực tiếp
                    </p>
                    <span className="text-xs font-medium text-slate-400">
                      Cập nhật tự động mỗi 10 giây
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <QueueRow
                      label="Đang phục vụ"
                      value={ticket.currentServing ?? "Chưa có ai"}
                      active={ticket.currentServing !== null}
                      detail="Đang được tư vấn"
                    />
                    <QueueRow
                      label="Vé của bạn"
                      value={display.ticketCode}
                      highlight
                      detail={
                        ticket.yourTurn
                          ? "Đến lượt của bạn - vui lòng đến phòng khám"
                          : ticket.personsAhead !== null
                            ? `${ticket.personsAhead} người trước bạn`
                            : "Đang cập nhật thứ tự..."
                      }
                    />
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-clinical-600 text-white">
                        <Users className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="text-sm">
                        <p className="font-semibold text-slate-900">
                          {display.room}
                        </p>
                        <p className="text-slate-500">
                          {display.doctor} sẵn sàng tiếp đón bạn ngay sau đây.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                /* Finished, cancelled or skipped: no queue to track any more. */
                <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Phiếu khám đã kết thúc
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    {FINISHED_NOTICES[ticket.status]}
                  </p>
                  <Link
                    to="/patient/booking"
                    className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-clinical-600 px-6 text-sm font-semibold text-white shadow-card transition-colors hover:bg-clinical-700"
                  >
                    Đặt lịch khám mới
                  </Link>
                </section>
              )}
            </div>
          ) : (
            <section className="mt-8 rounded-xl border border-slate-200/80 bg-white p-10 text-center shadow-card">
              <CalendarX size={32} className="mx-auto text-slate-300" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold text-slate-900">
                Bạn chưa có lịch hẹn khám nào đang hoạt động
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
