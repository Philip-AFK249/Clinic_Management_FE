/**
 * View model rendered by the pharmacy portal.
 *
 * The wire DTO lives in `services/clinicalApi`; `data/prescriptionMapper.ts`
 * projects `PrescriptionDetailResponse` onto this shape so the cards keep the
 * layout they had while every value they show comes from
 * ClinicalConsultationService.
 *
 * Fields the backend genuinely does not carry (demographics, room, allergies)
 * are `null` rather than invented - the UI renders them as "chưa có dữ liệu"
 * instead of implying a clinical fact it cannot verify.
 */
export type PrescriptionStatus =
  | "PENDING_PREPARATION" // Chờ soạn thuốc
  | "PREPARING" // Đang soạn thuốc
  | "READY_FOR_PICKUP" // Đã soạn xong / Chờ bệnh nhân quét mã
  | "DISPENSED" // Đã bàn giao thuốc
  | "CANCELLED"; // Đơn bị hủy ở bước duyệt

export type PaymentStatus =
  | "PAID_ONLINE" // Đã thanh toán qua App / VietQR
  | "PENDING_AT_COUNTER" // Chờ thanh toán tại quầy
  | "SETTLED_AT_COUNTER"; // Đã thu tiền mặt tại quầy

export interface MedicationItem {
  /** `PrescriptionItem.itemId` as a string, for React keys and toggles. */
  id: string;
  name: string;
  activeIngredient: string;
  dosageForm: string;
  instructions: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  bhytCoveragePercent: number; // 80 or 100 or 0
  stockUnits: number;
  isPacked: boolean;
  isAllergyRisk?: boolean;
}

export interface PharmacyOrder {
  orderId: string; // `Prescription.id`, e.g. "8821"
  encounterId: string; // `Encounter.id`, e.g. "8821"
  ticketCode: string; // "#A-102"
  patientName: string; // "NGUYỄN VĂN AN"
  patientId: string; // `patients.id` as a string
  /** Not exposed by the pharmacy API - `null` means "unknown". */
  dob: string | null;
  age: number | null;
  gender: "Nam" | "Nữ" | null;
  insuranceCode: string | null; // from the bệnh án
  initialHospitalCode: string | null; // from the bệnh án
  isOcrVerified: boolean;
  allergies: string[]; // patient allergies, empty when the API sends none
  prescribingDoctor: string; // "PGS. TS. BS. Trần Minh Tuấn"
  roomNumber: string | null;
  diagnosis: string | null;
  createdAt: string; // "09:15"
  status: PrescriptionStatus;
  paymentStatus: PaymentStatus;
  items: MedicationItem[];
  /**
   * Server-computed money. Present on every live order, so the billing card
   * quotes the amounts ClinicalConsultationService actually persisted instead
   * of re-deriving BHYT split in the browser.
   */
  totalAmount?: number;
  insurancePaidAmount?: number;
  patientCopayAmount?: number;
}
