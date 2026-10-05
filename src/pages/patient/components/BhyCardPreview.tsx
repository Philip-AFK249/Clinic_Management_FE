import { CheckCircle2, ShieldCheck } from "lucide-react";

/**
 * One renderer for the green BHYT card, shared by every place that shows one:
 * the scanner's result, a booking form seeded from the session, and the saved
 * card on the profile page.
 *
 * It was duplicated before this existed - the scanner had its own copy and the
 * profile page another - and they had already drifted. Plain display values in,
 * no data-source awareness, so the same component works whether it is showing a
 * fresh scan or a card read back out of the session.
 */
export interface BhyCardPreviewProps {
  fullName: string;
  /** Grouped, as printed: `DN 4 79 79 12345678`. */
  insuranceCode: string;
  /** As printed on the card, `14/08/1984`; use `dobLabelFrom()` for an ISO value. */
  dateOfBirthLabel?: string;
  /** As printed: `Nam` / `Nữ`. */
  gender?: string;
  hospital?: string;
  address?: string;
  /** The card's own validity line, e.g. `Từ 01/01/2019 đến 31/12/2028`. */
  validityDisplay?: string;
  /** Renders the verified badge. Omitted entirely when falsy. */
  verified?: boolean;
}

/**
 * The card.
 *
 * A reconstruction rather than a photo, because the point is to confirm the
 * *data* that was read. Fields with nothing to show are dropped entirely (their
 * label would be meaningless without a value) and the ones that do render fall
 * back to a dash, so an empty box is never mistaken for a printed blank.
 */
export default function BhyCardPreview({
  fullName,
  insuranceCode,
  dateOfBirthLabel,
  gender,
  hospital,
  address,
  validityDisplay,
  verified = false,
}: BhyCardPreviewProps) {
  const dob = dateOfBirthLabel?.trim();

  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-teal-800 to-emerald-950 p-5 text-left font-sans text-white shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
            Bảo hiểm xã hội Việt Nam
          </p>
          <p className="text-xs font-bold text-white">THẺ BẢO HIỂM Y TẾ</p>
        </div>
        <div className="flex items-center gap-2">
          {verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-50">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Đã xác thực BHYT
            </span>
          )}
          <span className="rounded bg-white/20 px-2 py-0.5 text-[11px] font-bold">
            BHYT
          </span>
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-2">
        <p className="text-[10px] font-medium uppercase text-emerald-200">
          Mã số thẻ:
        </p>
        <p className="font-mono text-xl font-bold tracking-widest text-amber-300">
          {insuranceCode || "-"}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        <div className="col-span-2">
          <dt className="text-[10px] font-medium uppercase text-emerald-200">
            Họ và tên:
          </dt>
          <dd className="font-bold uppercase text-white">{fullName || "-"}</dd>
        </div>

        {dob && (
          <div>
            <dt className="text-[10px] font-medium uppercase text-emerald-200">
              Ngày sinh:
            </dt>
            <dd className="font-medium text-white">{dob}</dd>
          </div>
        )}

        {gender && (
          <div>
            <dt className="text-[10px] font-medium uppercase text-emerald-200">
              Giới tính:
            </dt>
            <dd className="font-medium text-white">{gender}</dd>
          </div>
        )}

        {hospital && (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-[10px] font-medium uppercase text-emerald-200">
              Nơi ĐKKCB ban đầu:
            </dt>
            <dd className="text-[11px] font-medium text-white/90">{hospital}</dd>
          </div>
        )}

        {address && (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-[10px] font-medium uppercase text-emerald-200">
              Địa chỉ:
            </dt>
            <dd className="line-clamp-2 text-[11px] text-white/90">{address}</dd>
          </div>
        )}

        {validityDisplay && (
          <div className="col-span-2 flex justify-between gap-3 border-t border-white/10 pt-1 text-[10px] text-emerald-200 sm:col-span-3">
            <dt className="flex shrink-0 items-center gap-1 font-medium uppercase">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Giá trị sử dụng:
            </dt>
            <dd className="text-right">{validityDisplay}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}