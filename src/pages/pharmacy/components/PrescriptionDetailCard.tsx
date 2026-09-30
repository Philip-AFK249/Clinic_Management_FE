import { AlertTriangle, BadgeCheck, User, Stethoscope } from "lucide-react";
import type { PharmacyOrder } from "../data/pharmacyTypes";

interface PrescriptionDetailCardProps {
  order: PharmacyOrder;
}

export default function PrescriptionDetailCard({
  order,
}: PrescriptionDetailCardProps) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white shadow-card">
      <div className="grid grid-cols-12 gap-4 p-4">
        {/* Demographics */}
        <div className="col-span-8">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-bold text-slate-900">
              {order.patientName}
            </h2>
            {/* The pharmacy API carries no demographics - say so, don't guess. */}
            <span className="text-xs font-medium text-slate-500">
              {order.age !== null ? `${order.age} tuổi` : "Chưa rõ tuổi"}
              {order.gender ? `, ${order.gender}` : ""}
            </span>
            <span className="bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-700">
              {order.ticketCode}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <User className="h-3 w-3" aria-hidden="true" />
            ID Bệnh nhân:{" "}
            <span className="font-mono font-medium text-slate-700">
              {order.patientId}
            </span>{" "}
            &middot; Ngày sinh: {order.dob ?? "Chưa rõ"}
          </p>

          {/* Doctor + room */}
          <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
            <Stethoscope className="h-3 w-3" aria-hidden="true" />
            Bác sĩ kê đơn:{" "}
            <span className="font-medium text-slate-700">
              {order.prescribingDoctor}
            </span>{" "}
            &middot; {order.roomNumber ?? "Chưa rõ phòng khám"}
          </p>

          {/* Clinical diagnosis */}
          <p className="mt-1 text-xs text-slate-500">
            Chẩn đoán lâm sàng:{" "}
            <span className="font-semibold text-teal-700">
              {order.diagnosis ?? "Xem trên bệnh án điện tử"}
            </span>
          </p>
        </div>

        {/* BHYT pill */}
        <div className="col-span-4 flex flex-col items-end justify-center gap-2">
          {order.isOcrVerified ? (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ✓ Thẻ BHYT: {order.insuranceCode}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
              Không có mã BHYT trên đơn
            </span>
          )}
          <span className="text-right text-[11px] text-slate-500">
            {order.initialHospitalCode ?? "Nơi KCB đầu tiên: chưa cập nhật"}
          </span>
        </div>
      </div>

      {/* Allergy safety lock */}
      {order.allergies.length > 0 && (
        <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            ⚠️ CẢNH BÁO DỊ ỨNG: Bệnh nhân có tiền sử dị ứng với{" "}
            {order.allergies.join(" & ")}. Vui lòng đối soát kỹ thành phần
            trước khi xuất kho.
          </span>
        </div>
      )}
    </section>
  );
}
