import { CheckCircle2, MapPin, X } from "lucide-react";

interface KioskWayfindingModalProps {
  onClose: () => void;
}

const GROUND_FLOOR = [
  { id: "kiosk01", name: "Kiosk #01", highlight: true },
  { id: "frontdesk", name: "Quầy Tiếp Đón" },
  { id: "pharmacy1", name: "Quầy Dược #1" },
  { id: "room104", name: "Phòng 104 (Khám Nội)" },
  { id: "room108", name: "Phòng 108 (Khám Nhi)" },
];

const SECOND_FLOOR = [
  { id: "elevator", name: "Thang Máy" },
  { id: "stairs", name: "Cầu Thang Bộ" },
  { id: "room201", name: "Phòng 201 (Khối Ngoại - Thủ thuật)", highlight: true },
  { id: "room205", name: "Phòng 205 (Tai Mũi Họng)" },
];

function RoomChip({
  name,
  highlight = false,
  active = false,
}: {
  name: string;
  highlight?: boolean;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? "border-clinical-500 bg-clinical-50 text-clinical-700"
          : highlight
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {highlight && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
      {name}
    </span>
  );
}

export default function KioskWayfindingModal({ onClose }: KioskWayfindingModalProps) {
  return (
    <div className="fixed inset-0 z-50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex h-full w-full flex-col bg-surface-light">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-8 py-5">
          <div className="flex items-center gap-3">
            <MapPin className="h-8 w-8 text-clinical-600" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Sơ Đồ Chỉ Đường Phòng Khám</h2>
              <p className="text-sm text-slate-500">
                Từ Kiosk #01 (Sảnh A, Tầng Trệt) đến Phòng khám 201 (Tầng 2)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng sơ đồ chỉ đường"
            className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-transform active:scale-95"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Floor plan */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-8">
          <section>
            <p className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
              Tầng Trệt
            </p>
            <div className="grid grid-cols-6 gap-3">
              {GROUND_FLOOR.map((room) => (
                <RoomChip key={room.id} name={room.name} highlight={room.highlight} />
              ))}
            </div>
          </section>

          {/* Route indicator */}
          <div className="flex items-center gap-4 self-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-clinical-200 bg-clinical-50 text-2xl">
              📍
            </span>
            <span className="text-3xl font-bold text-clinical-500" aria-hidden="true">
              →
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-2xl">
              🛗
            </span>
            <span className="text-3xl font-bold text-clinical-500" aria-hidden="true">
              →
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-2xl">
              🚪
            </span>
          </div>

          <section>
            <p className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
              Tầng 2
            </p>
            <div className="grid grid-cols-6 gap-3">
              {SECOND_FLOOR.map((room) => (
                <RoomChip
                  key={room.id}
                  name={room.name}
                  highlight={room.highlight}
                  active={room.id === "room201"}
                />
              ))}
            </div>
          </section>

          <section className="mt-2 flex items-start gap-4 rounded-2xl border-2 border-clinical-200 bg-clinical-50 p-5">
            <span className="text-3xl">🗺️</span>
            <div>
              <p className="text-lg font-bold text-slate-900">Chỉ Dẫn Từng Bước</p>
              <p className="mt-1 text-base leading-relaxed text-slate-700">
                Xuất phát từ <strong>Kiosk #01 (Sảnh A)</strong>. Đi thẳng 10m tới{" "}
                <strong>Thang máy A</strong>, bấm nút lên <strong>Tầng 2</strong>. Ra khỏi thang
                máy, rẽ phải 5m là <strong>Phòng khám 201</strong>.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200/80 bg-white p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-16 w-full items-center justify-center rounded-xl bg-clinical-600 text-lg font-bold text-white shadow-md transition-all hover:bg-clinical-700 active:scale-95"
          >
            Tôi Đã Rõ. Đóng Sơ Đồ
          </button>
        </div>
      </div>
    </div>
  );
}