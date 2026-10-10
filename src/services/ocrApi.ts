import axios from "axios";

/**
 * Typed HTTP client for the AI Gateway (FastAPI), which exposes the BHYT card
 * OCR endpoint the reception desk and the booking form call to autofill a
 * patient's identity.
 *
 * Talks to the gateway **directly** at `VITE_RAG_API_URL` (default
 * http://localhost:8008) rather than through the Vite dev proxy, exactly like
 * `voiceTriageApi`: CORS is open on the server side (`allow_origins=["*"]`),
 * so a cross-origin multipart upload needs no proxy rule.
 */
export const OCR_BASE_URL: string = (
  import.meta.env.VITE_RAG_API_URL || "http://localhost:8008"
).replace(/\/+$/, "");

/** BHYT card scan endpoint, relative to the gateway root. */
const BHYT_OCR_PATH = "/api/v1/ocr/bhyt";

export const ocrApi = axios.create({
  baseURL: OCR_BASE_URL,
  // A Groq VLM round-trip on a phone photo is seconds, not milliseconds - the
  // 6-8s used by the Spring services would abort a scan that is about to
  // succeed.
  timeout: 60000,
});

// ---------------------------------------------------------------------------
// DTOs - mirror the gateway's `BhytOcrResponse` / `BhytData` Pydantic models.
//
// Every field on `BhytData` is optional because it comes out of a vision model:
// any individual key can be missing when the print on the card is blurry or
// cropped, and the gateway drops what it could not read instead of sending
// `null`. `isExpired` and `isOcrVerified` are non-null booleans with defaults on
// the Python side, so they stay required here.
// ---------------------------------------------------------------------------

/**
 * Structured payload extracted from a BHYT card.
 *
 * Carries parallel representations of the same card: the `snake_case` fields are
 * what is literally printed on the card, while the `camelCase` mirrors are what
 * the Spring services consume. Only the `snake_case` keys are guaranteed by the
 * endpoint's contract, which is why the mirrors are optional.
 *
 * The mirrors are NOT safe to bind straight into the form, so prefer the
 * snake_case keys and see `toBhyTelemetry`:
 * - `insuranceCode` is the *unformatted* `ma_so_bhyt` (`DN4797912345678`), not
 *   the grouped `ma_so_bhyt_formatted` (`DN 4 79 79 12345678`).
 * - `initialHospitalCode` is the facility *name* (`BV Da Khoa Sai Gon`), not
 *   the `noi_kcb_ban_dau_full` string that carries the code too
 *   (`79-014 (BV Da Khoa Sai Gon)`).
 */
export interface BhytOcrData {
  ho_ten: string | null;
  ma_so_bhyt: string | null;
  ma_so_bhyt_formatted: string | null;
  ngay_sinh: string | null;
  ngay_sinh_iso: string | null;
  gioi_tinh: string | null;
  /** Địa chỉ printed in the small print under the holder's name. */
  dia_chi: string | null;
  ma_noi_dkkcb_ban_dau: string | null;
  noi_kham_chua_benh_ban_dau: string | null;
  noi_kcb_ban_dau_full: string | null;
  gia_tri_su_dung_tu: string | null;
  gia_tri_su_dung_den: string | null;
  /** Pre-rendered validity line, e.g. `Từ 01/01/2019`. */
  han_su_dung_display: string | null;
  con_han: boolean | null;
  ghi_chu: string | null;
  /* camelCase mirrors, for the Spring Boot services. */
  fullName?: string | null;
  insuranceCode?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  initialHospitalCode?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  isExpired?: boolean;
  isOcrVerified?: boolean;
}

export interface BhytOcrResponse {
  success: boolean;
  data: BhytOcrData;
  /** Non-fatal notes, e.g. a field the model could not read with confidence. */
  warnings?: string[];
  /* Diagnostics the gateway only emits when it runs with debugging on. */
  model?: string;
  latency_ms?: number;
  /** `data:` URL of the card as the gateway received it - handy for debugging. */
  image_preview?: string;
  image_size_kb?: number;
  raw_text?: string;
}

/**
 * Raised when the gateway rejects the upload or answers with a payload we
 * cannot bind. Carries the gateway's own Vietnamese message when it sent one so
 * the UI can surface something more specific than a generic failure.
 */
export class BhytOcrError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "BhytOcrError";
    this.status = status;
  }
}

/**
 * Read the `detail` string a FastAPI error carries.
 *
 * FastAPI answers a rejected upload with `{"detail": "..."}`, but a request that
 * fails schema validation answers with `{"detail": [{loc, msg, type}, ...]}`, so
 * the value has to be probed rather than cast.
 */
function detailOf(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: unknown };
    return typeof first?.msg === "string" ? first.msg.trim() : "";
  }
  return "";
}

/** Trimmed string, or `""` for null/undefined/whitespace. */
function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Normalise a card date to `YYYY-MM-DD` so it binds to `<input type="date">`.
 *
 * `ngay_sinh_iso` is already meant to be ISO, but a vision model can return it
 * empty or `dd/mm/yyyy`; the printed `ngay_sinh` (`14/08/1984`) is the fallback.
 * Anything unparseable yields `""` rather than a half-formed value, so the date
 * input is simply left empty instead of showing garbage.
 */
export function toIsoDate(value: string | null | undefined): string {
  const raw = text(value);
  if (!raw) return "";

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(raw);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return "";
}

/**
 * The form-facing view of a scan.
 *
 * Declared locally (rather than imported from the patient page) to keep the
 * service layer free of UI concerns; `BhyTelemetry` in
 * `pages/patient/data/patientMockRecords` structurally satisfies it.
 *
 * There is deliberately no `phone`: a BHYT card carries no phone number, so a
 * scan must leave whatever the patient typed by hand in place.
 */
export interface BhytTelemetryView {
  fullName: string;
  insuranceCode: string;
  /** `YYYY-MM-DD`, ready for `<input type="date">`. */
  dateOfBirth: string;
  /** The date as printed on the card, e.g. `14/08/1984`. */
  dateOfBirthLabel: string;
  gender: string;
  /** Địa chỉ as printed on the card. */
  address: string;
  /** `code (facility)`, e.g. `79-014 (BV Đa Khoa Sài Gòn)`. */
  initialHospitalCode: string;
  /** Alias of `initialHospitalCode`. */
  hospital: string;
  /** `YYYY-MM-DD` bounds of the card's own validity window. */
  validFrom: string;
  validUntil: string;
  /** The same window as printed, e.g. `Từ 01/01/2019`. */
  validityDisplay: string;
  isOcrVerified: boolean;
}

/**
 * Rebuild the card's validity line when the gateway did not render one.
 *
 * `han_su_dung_display` is the gateway's own wording, so it wins whenever it is
 * present; the two raw dates are only the fallback, kept in their printed
 * `dd/mm/yyyy` form because this string is shown next to the card, not parsed.
 */
function toValidityDisplay(data: BhytOcrData): string {
  const rendered = text(data.han_su_dung_display);
  if (rendered) return rendered;

  const from = text(data.gia_tri_su_dung_tu);
  const until = text(data.gia_tri_su_dung_den);
  if (from && until) return `Từ ${from} đến ${until}`;
  if (from) return `Từ ${from}`;
  if (until) return `Đến ${until}`;
  return "";
}

/**
 * Fold an OCR payload into the values the booking form binds.
 *
 * Field selection follows what is actually printed on the card, so the mapping
 * deliberately prefers `snake_case` over the camelCase mirrors (see
 * `BhytOcrData`):
 *
 * - fullName            <- `ho_ten`
 * - insuranceCode       <- `ma_so_bhyt_formatted` || `ma_so_bhyt` (grouped form)
 * - dateOfBirth         <- `ngay_sinh_iso` (|| `ngay_sinh`), forced to ISO
 * - gender              <- `gioi_tinh`
 * - address             <- `dia_chi`
 * - initialHospitalCode <- `noi_kcb_ban_dau_full` (code *and* facility name)
 * - validityDisplay     <- `han_su_dung_display` (|| the raw date pair)
 * - phone               <- untouched: not printed on a BHYT card
 *
 * `isOcrVerified` is set true because reaching this point means the gateway
 * accepted and parsed the upload.
 */
export function toBhyTelemetry(data: BhytOcrData): BhytTelemetryView {
  const fullName = text(data.ho_ten);
  const insuranceCode = text(data.ma_so_bhyt_formatted) || text(data.ma_so_bhyt);
  const initialHospitalCode = text(data.noi_kcb_ban_dau_full);
  const dateOfBirth = toIsoDate(data.ngay_sinh_iso) || toIsoDate(data.ngay_sinh);

  return {
    fullName,
    insuranceCode,
    dateOfBirth,
    dateOfBirthLabel: text(data.ngay_sinh),
    gender: text(data.gioi_tinh),
    address: text(data.dia_chi),
    initialHospitalCode,
    hospital: initialHospitalCode,
    validFrom: toIsoDate(data.gia_tri_su_dung_tu),
    validUntil: toIsoDate(data.gia_tri_su_dung_den),
    validityDisplay: toValidityDisplay(data),
    isOcrVerified: true,
  };
}

/**
 * Upload a BHYT card / old prescription photo and return the raw gateway
 * payload (extracted fields, warnings, model diagnostics).
 *
 * The gateway is a Groq VLM call, so this takes seconds and can fail on a blurry
 * photo; every failure mode is funnelled into a `BhytOcrError` so callers have
 * a single thing to catch instead of unpacking axios errors.
 */
export async function uploadBhytCardApi(file: File): Promise<BhytOcrResponse> {
  const form = new FormData();
  form.append("file", file);

  let payload: BhytOcrResponse;
  try {
    // No explicit Content-Type: axios has to pick the multipart type itself so
    // the `boundary` separator is appended. Setting it by hand - as the JSON
    // services do in their axios defaults - yields an unparseable request body.
    const response = await ocrApi.post<BhytOcrResponse>(BHYT_OCR_PATH, form);
    payload = response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = detailOf(error.response?.data);
      const status = error.response?.status;
      if (detail) throw new BhytOcrError(detail, status);
      if (error.code === "ECONNABORTED") {
        throw new BhytOcrError("Yêu cầu quét thẻ quá thời gian chờ.", status);
      }
      throw new BhytOcrError(
        status
          ? `Máy chủ nhận diện thẻ trả về lỗi ${status}.`
          : "Không thể kết nối tới máy chủ nhận diện thẻ.",
        status,
      );
    }
    throw error;
  }

  if (!payload?.success || !payload.data) {
    throw new BhytOcrError(
      detailOf(payload) || "Máy chủ không trả về thông tin thẻ hợp lệ.",
    );
  }

  return payload;
}

/**
 * Upload a card and fold the payload into the booking form's telemetry view.
 *
 * A card the model could not read at all is a failure, not a blank form: the
 * caller needs to hear about it so it can offer manual entry.
 */
export async function scanBhytCard(file: File): Promise<BhytTelemetryView> {
  const payload = await uploadBhytCardApi(file);
  const telemetry = toBhyTelemetry(payload.data);

  if (!telemetry.fullName && !telemetry.insuranceCode) {
    throw new BhytOcrError(
      "Không đọc được thông tin trên thẻ. Vui lòng thử lại với ảnh rõ nét hơn.",
    );
  }

  return telemetry;
}