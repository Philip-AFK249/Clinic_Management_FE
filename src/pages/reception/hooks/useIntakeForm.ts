import { useCallback, useMemo, useState } from "react";
import type { AdministrativeIntakeRequest, IntakeSource, TriagePriority } from "../../../services/intakeApi";
import { toIsoDate as toOcrIsoDate } from "../../../services/ocrApi";
import type { BhytOcrData } from "../../../services/ocrApi";
import { RECEPTION_DEPARTMENTS, toIsoDate } from "../data/receptionMockData";
import type { OcrCardSample } from "../data/receptionMockData";

export type IntakeMode = "SCAN" | "MANUAL";

export interface IntakeFormState {
  mode: IntakeMode;
  fullName: string;
  identityCardNumber: string;
  insuranceCode: string;
  initialHospitalCode: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  isOcrVerified: boolean;
  departmentId: number;
  appointmentDate: string;
  slotStartTime: string;
  priorityLevel: TriagePriority;
  chiefComplaint: string;
}

export type IntakeField = Exclude<keyof IntakeFormState, "mode" | "isOcrVerified">;

export type IntakeErrors = Partial<Record<IntakeField, string>>;

// ---------------------------------------------------------------------------
// Vietnamese identity formats
// ---------------------------------------------------------------------------

/** CCCD (căn cước công dân gắn chip): exactly 12 digits, no separators. */
const CCCD_PATTERN = /^\d{12}$/;

/**
 * Thẻ BHYT, 15 characters in the printed order:
 *   2 letters      - mã tỉnh / thành phố (e.g. "DN")
 *   1 digit [1-5]  - mã tuyến (insurance tier: khám chữa bệnh in-depth)
 *   2 digits 01-99 - mã tỉnh / thành phố issuing the card
 *   10 digits      - mã số của người tham gia bảo hiểm
 * The card prints these groups separated by spaces or dashes, so both are
 * stripped before matching.
 */
const BHYT_PATTERN = /^[A-Z]{2}[1-5](0[1-9]|[1-9][0-9])\d{10}$/;

/** Mobile numbers only: 10 digits starting 03 / 05 / 07 / 08 / 09. */
const PHONE_PATTERN = /^(03|05|07|08|09)\d{8}$/;

/**
 * Vietnamese names: any Unicode letter or combining mark (so precomposed
 * U+1EA0-U+1EF9 and NFD input both pass) plus the separators and punctuation a
 * registered name may legitimately carry: space, dot, hyphen, apostrophe.
 */
const ILLEGAL_NAME_CHARS = /[^\p{L}\p{M}\s.'’-]/u;
const MIN_NAME_WORDS = 2;
const MIN_COMPLAINT_LENGTH = 10;

function today(): string {
  return toIsoDate(new Date());
}

/**
 * Compact form of a BHYT card number, which the backend stores and matches on:
 * "DN 4 79 79 12345678" / "DN-4-79-79-12345678" -> "DN4797912345678".
 */
export function normalizeInsuranceCode(value: string): string {
  return value.replace(/[\s-]+/g, "").toUpperCase();
}

/**
 * The card prints `Nam` / `Nữ`; the rest of the system (admin roster, patient
 * profile, doctor queue) stores the `MALE` / `FEMALE` enum, so an OCR-applied
 * gender is folded to match. Anything unrecognised is passed through trimmed.
 */
export function normalizeOcrGender(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (raw.length === 0) return "";
  const upper = raw.toUpperCase();
  if (upper === "NAM" || upper === "MALE" || upper === "M") return "MALE";
  if (upper === "NỮ" || upper === "NU" || upper === "FEMALE" || upper === "F") {
    return "FEMALE";
  }
  return raw;
}

function createInitialState(): IntakeFormState {
  return {
    mode: "SCAN",
    fullName: "",
    identityCardNumber: "",
    insuranceCode: "",
    initialHospitalCode: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    address: "",
    isOcrVerified: false,
    departmentId: RECEPTION_DEPARTMENTS[0].id,
    appointmentDate: today(),
    slotStartTime: "",
    priorityLevel: "P3",
    chiefComplaint: "",
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function validateIntakeForm(form: IntakeFormState): IntakeErrors {
  const errors: IntakeErrors = {};

  const fullName = form.fullName.trim();
  if (fullName.length === 0) {
    errors.fullName = "Họ tên bệnh nhân là bắt buộc.";
  } else if (ILLEGAL_NAME_CHARS.test(fullName)) {
    errors.fullName =
      "Họ tên chứa ký tự không hợp lệ. Chỉ dùng chữ cái, dấu cách và các dấu . - '.";
  } else if (fullName.split(/\s+/).filter(Boolean).length < MIN_NAME_WORDS) {
    errors.fullName = "Vui lòng nhập đầy đủ họ và tên (tối thiểu 2 từ).";
  }

  const idCard = form.identityCardNumber.trim();
  if (idCard.length > 0 && !CCCD_PATTERN.test(idCard)) {
    errors.identityCardNumber =
      "Số CCCD phải gồm đúng 12 chữ số, không có khoảng trắng hoặc dấu gạch.";
  }

  const insurance = normalizeInsuranceCode(form.insuranceCode);
  if (insurance.length > 0 && !BHYT_PATTERN.test(insurance)) {
    errors.insuranceCode =
      "Mã thẻ BHYT phải gồm 15 ký tự: 2 chữ cái + 1 số (1-5) + 2 số tỉnh + 10 số (dạng DN 4 79 79 12345678).";
  }

  if (form.dateOfBirth) {
    const dob = new Date(form.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      errors.dateOfBirth = "Ngày sinh không hợp lệ.";
    } else if (dob.getTime() > Date.now()) {
      errors.dateOfBirth = "Ngày sinh không được nằm trong tương lai.";
    } else {
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age > 120) {
        errors.dateOfBirth = "Ngày sinh không hợp lý với bệnh nhân đang khám.";
      }
    }
  }

  const phone = form.phone.trim();
  if (phone.length > 0 && !PHONE_PATTERN.test(phone)) {
    errors.phone =
      "Số điện thoại di động Việt Nam phải gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.";
  }
  if (!Number.isFinite(form.departmentId) || form.departmentId <= 0) {
    errors.departmentId = "Vui lòng chọn chuyên khoa tiếp nhận.";
  }

  if (!form.appointmentDate) {
    errors.appointmentDate = "Vui lòng chọn ngày khám.";
  } else if (form.appointmentDate < today()) {
    errors.appointmentDate = "Ngày khám không được nằm trong quá khứ.";
  }

  if (!form.slotStartTime) {
    errors.slotStartTime = "Vui lòng chọn khung giờ 60 phút còn trống.";
  }

  if (!form.priorityLevel) {
    errors.priorityLevel = "Vui lòng phân loại mức độ ưu tiên triage.";
  }

  const complaint = form.chiefComplaint.trim();
  if (complaint.length === 0) {
    errors.chiefComplaint = "Lý do vào viện là bắt buộc để bác sĩ nắm tình trạng.";
  } else if (complaint.length < MIN_COMPLAINT_LENGTH) {
    errors.chiefComplaint = `Mô tả lý do vào viện tối thiểu ${MIN_COMPLAINT_LENGTH} ký tự để bác sĩ đánh giá được mức độ ưu tiên.`;
  }

  return errors;
}

/**
 * A scanned card is fed by the same reader as the kiosk, so its provenance is
 * KIOSK_OCR; anything the secretary types in is RECEPTION_MANUAL.
 */
export function intakeSourceFor(mode: IntakeMode): IntakeSource {
  return mode === "SCAN" ? "KIOSK_OCR" : "RECEPTION_MANUAL";
}

export function useIntakeForm() {
  const [form, setForm] = useState<IntakeFormState>(createInitialState);

  const updateField = useCallback(
    <K extends keyof IntakeFormState>(field: K, value: IntakeFormState[K]) => {
      setForm((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const setMode = useCallback((mode: IntakeMode) => {
    setForm((current) => ({
      ...current,
      mode,
      // Leaving scan mode invalidates any OCR-derived identity claim.
      isOcrVerified: mode === "SCAN" ? current.isOcrVerified : false,
    }));
  }, []);

  /** Populate identity fields from a reader result. */
  const applyOcrSample = useCallback((sample: OcrCardSample, verified: boolean) => {
    setForm((current) => ({
      ...current,
      mode: "SCAN",
      fullName: sample.fullName,
      identityCardNumber: sample.identityCardNumber,
      insuranceCode: sample.insuranceCode,
      initialHospitalCode: sample.initialHospitalCode,
      dateOfBirth: sample.dateOfBirth,
      gender: normalizeOcrGender(sample.gender) || current.gender,
      phone: sample.phone,
      address: sample.address,
      isOcrVerified: verified,
    }));
  }, []);

  /**
   * Fold a real AI Gateway OCR payload into the intake form.
   *
   * Field selection mirrors `toBhyTelemetry`: prefer the snake_case keys the
   * endpoint guarantees over the camelCase mirrors. The BHYT card carries no
   * phone number or street address, so those hand-typed fields are left alone,
   * and `initialHospitalCode` keeps the `"79-014 (BV ...)"` combined format the
   * identity form reads and writes.
   */
  const applyOcrResult = useCallback((ocrData: BhytOcrData) => {
    const hospitalCode = (ocrData.ma_noi_dkkcb_ban_dau ?? ocrData.initialHospitalCode ?? "").trim();
    const hospitalName = (ocrData.noi_kham_chua_benh_ban_dau ?? "").trim();
    const hospitalFull =
      (ocrData.noi_kcb_ban_dau_full ?? "").trim() ||
      (hospitalCode && hospitalName ? `${hospitalCode} (${hospitalName})` : hospitalCode);

    setForm((current) => ({
      ...current,
      mode: "SCAN",
      fullName: (ocrData.ho_ten ?? ocrData.fullName ?? "").trim() || current.fullName,
      insuranceCode:
        normalizeInsuranceCode(ocrData.ma_so_bhyt ?? ocrData.insuranceCode ?? "") ||
        current.insuranceCode,
      dateOfBirth:
        toOcrIsoDate(ocrData.ngay_sinh_iso) ||
        toOcrIsoDate(ocrData.dateOfBirth) ||
        toOcrIsoDate(ocrData.ngay_sinh) ||
        current.dateOfBirth,
      gender: normalizeOcrGender(ocrData.gioi_tinh ?? ocrData.gender) || current.gender,
      initialHospitalCode: hospitalFull || current.initialHospitalCode,
      isOcrVerified: true,
    }));
  }, []);

  const reset = useCallback(() => {
    setForm(createInitialState());
  }, []);

  const validate = useCallback((): IntakeErrors => validateIntakeForm(form), [form]);

  const departmentName = useMemo(
    () =>
      RECEPTION_DEPARTMENTS.find((d) => d.id === form.departmentId)?.name ?? "",
    [form.departmentId],
  );

  const toRequest = useCallback((): AdministrativeIntakeRequest => {
    return {
      fullName: form.fullName.trim().replace(/\s+/g, " "),
      identityCardNumber: optional(form.identityCardNumber),
      // The card is printed in spaced groups; the stored number is compact.
      insuranceCode: optional(normalizeInsuranceCode(form.insuranceCode)),
      initialHospitalCode: optional(form.initialHospitalCode),
      dateOfBirth: optional(form.dateOfBirth),
      gender: optional(form.gender),
      phone: optional(form.phone),
      address: optional(form.address),
      isOcrVerified: form.isOcrVerified,
      departmentId: form.departmentId,
      departmentName,
      appointmentDate: form.appointmentDate,
      slotStartTime: form.slotStartTime,
      priorityLevel: form.priorityLevel,
      intakeSource: intakeSourceFor(form.mode),
      chiefComplaint: optional(form.chiefComplaint),
    };
  }, [departmentName, form]);

  /** True when a slot is still selectable (never submit against a stale one). */
  const isSlotConsistent = useCallback(
    (slots: { startTime: string; isAvailable: boolean }[]): boolean => {
      if (!form.slotStartTime) return false;
      return slots.some(
        (slot) => slot.startTime === form.slotStartTime && slot.isAvailable,
      );
    },
    [form.slotStartTime],
  );

  return {
    form,
    departmentName,
    intakeSource: intakeSourceFor(form.mode),
    updateField,
    setMode,
    applyOcrSample,
    applyOcrResult,
    reset,
    validate,
    toRequest,
    isSlotConsistent,
  };
}
