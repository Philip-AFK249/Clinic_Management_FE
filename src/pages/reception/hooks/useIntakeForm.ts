import { useCallback, useMemo, useState } from "react";
import type { AdministrativeIntakeRequest, IntakeSource, TriagePriority } from "../../../services/intakeApi";
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

const CCCD_PATTERN = /^\d{9}(\d{3})?$/;
const PHONE_PATTERN = /^0\d{9,10}$/;
const MIN_COMPLAINT_LENGTH = 10;

function today(): string {
  return toIsoDate(new Date());
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
  } else if (fullName.length < 2) {
    errors.fullName = "Họ tên quá ngắn, vui lòng nhập đầy đủ họ và tên.";
  }

  const idCard = form.identityCardNumber.trim();
  if (idCard.length > 0 && !CCCD_PATTERN.test(idCard)) {
    errors.identityCardNumber = "Số CCCD phải gồm 9 hoặc 12 chữ số.";
  }

  const insurance = form.insuranceCode.trim();
  if (insurance.length > 0 && insurance.length < 10) {
    errors.insuranceCode = "Mã thẻ BHYT phải có ít nhất 10 ký tự (dạng DN 4 79 79 ......).";
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
    errors.phone = "Số điện thoại phải bắt đầu bằng 0 và có 10-11 chữ số.";
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
      gender: sample.gender,
      phone: sample.phone,
      address: sample.address,
      isOcrVerified: verified,
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
      fullName: form.fullName.trim(),
      identityCardNumber: optional(form.identityCardNumber),
      insuranceCode: optional(form.insuranceCode),
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
    reset,
    validate,
    toRequest,
    isSlotConsistent,
  };
}
