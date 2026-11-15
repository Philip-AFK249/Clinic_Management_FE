import { Car, Clock, MapPin, QrCode } from "lucide-react";
import { CLINIC_FACILITY_IMAGE } from "../data/clinicContent";

const FACILITY_DETAILS = [
  {
    icon: Clock,
    label: "Giờ mở cửa",
    value: "T2 - CN: 07:30 - 20:30",
  },
  {
    icon: Car,
    label: "Bãi đỗ xe",
    value: "Đỗ xe miễn phí tại bãi phía sau tòa nhà",
  },
  {
    icon: QrCode,
    label: "Check-in nhanh",
    value: "Xếp hàng quét QR chỉ ~5 phút, sau đó đến thẳng phòng khám",
  },
];

export default function ClinicFacility() {
  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        {/* Image */}
        <div
          className={`relative overflow-hidden rounded-2xl border border-slate-200/80 shadow-elevated ${CLINIC_FACILITY_IMAGE.aspect}`}
        >
          <img
            src={CLINIC_FACILITY_IMAGE.url}
            alt={CLINIC_FACILITY_IMAGE.alt}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {/* Content */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-clinical-600">
            Hạ tầng hiện đại
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Cơ Sở Khám Chữa Bệnh Hiện Đại, Đạt Chuẩn
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
            Các phòng khám của chúng tôi được thiết kế hiện đại, sạch sẽ và dễ
            di chuyển. Vào giờ cao điểm, quầy kiosk QR giúp rút ngắn thời gian
            chờ xuống chỉ vài phút từ cửa vào đến phòng khám.
          </p>

          <ul className="mt-6 space-y-4">
            {FACILITY_DETAILS.map((detail) => {
              const Icon = detail.icon;
              return (
                <li key={detail.label} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-clinical-50 text-clinical-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {detail.label}
                    </p>
                    <p className="mt-0.5 text-base leading-relaxed text-slate-600">
                      {detail.value}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 inline-flex items-center gap-2 text-base font-medium text-slate-600">
            <MapPin className="h-5 w-5 text-clinical-600" />
            Tất cả các cơ sở tiếp nhận bệnh nhân vãng lai trong suốt giờ mở
            cửa.
          </p>
        </div>
      </div>
    </section>
  );
}