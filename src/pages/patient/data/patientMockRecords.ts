export type TriagePriority = "P1" | "P2" | "P3";

export interface BhyTelemetry {
  fullName: string;
  insuranceCode: string;
  /** `YYYY-MM-DD`, ready for `<input type="date">`. */
  dateOfBirth: string;
  /** The date as printed on the card, e.g. `14/08/1984`. */
  dateOfBirthLabel?: string;
  /** As printed on the card: `Nam` / `Nữ`. */
  gender?: string;
  /** Địa chỉ in nhỏ dưới tên chủ thẻ. */
  address?: string;
  /** `code (facility)`, e.g. `79-014 (BV Đa Khoa Sài Gòn)`. */
  initialHospitalCode: string;
  /** Alias of `initialHospitalCode`. */
  hospital?: string;
  /** `YYYY-MM-DD` bounds of the card's own validity window, when read. */
  validFrom?: string;
  validUntil?: string;
  /** The validity window as printed, e.g. `Từ 01/01/2019`. */
  validityDisplay?: string;
  /** True once the card has actually been read back through the OCR service. */
  isOcrVerified?: boolean;
}

/**
 * The preset behind "Xem ảnh thẻ mẫu": the payload
 * `POST /api/v1/ocr/bhyt` returns for the sample card in the demo walkthrough,
 * already folded into the form-facing shape by `toBhyTelemetry`.
 *
 * Kept in sync with the gateway's `BhytData` contract, which is why the sample
 * carries the address and the validity line as well.
 */
export const DEMO_BHYT_CARD: BhyTelemetry = {
  fullName: "NGÔ THỊ KIỀU NGÂN",
  insuranceCode: "HC 4 91 53 61000392",
  dateOfBirth: "1980-01-18",
  dateOfBirthLabel: "18/01/1980",
  gender: "Nữ",
  address: "Lâm Quang Ky, Rạch Giá, Kiên Giang",
  initialHospitalCode: "79-014 (BV Đa Khoa Sài Gòn)",
  hospital: "79-014 (BV Đa Khoa Sài Gòn)",
  validFrom: "2019-01-01",
  validityDisplay: "Từ 01/01/2019",
  isOcrVerified: true,
};

export interface TriageSuggestion {
  department: string;
  priority: TriagePriority;
  priorityLabel: string;
  confidence: number;
  summary: string;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function triageSymptoms(symptoms: string): TriageSuggestion | null {
  const text = normalizeText(symptoms);
  if (!text) return null;

  const emergency = /(chest pain|difficulty breathing|shortness of breath|short of breath|faint|unconscious|so ngu|kho tho|kho tho cap|nguc|ngat|bat tinh|dau nguc)/;
  const allergy = /(allerg|dich ung|rash|itch|hive|sneeze|hen\s?xuyen|hay fever|wheez|eczema|ngua|phat ban|me day|noi man|noi me day)/;
  const respiratory = /(asthma|cough|cold|sore throat|sot|ho|viem hong|dau rat hong|long nguc)/;
  const child = /(child|baby|toddler|infant|kid|tre em|be|em be)/;
  const skin = /(skin|dermatitis|da lieu|cham|ngua)/;

  if (emergency.test(text)) {
    return {
      department: "Khám Nội Tổng quát & Tầm soát",
      priority: "P1",
      priorityLabel: "P1 - Khẩn cấp (Ưu tiên 1)",
      confidence: 97,
      summary:
        "Triệu chứng khớp với các dấu hiệu nguy hiểm cần cấp cứu. Nên được bác sĩ đánh giá ngay lập tức, không xếp hàng chờ.",
    };
  }
  if (allergy.test(text)) {
    return {
      department: "Xét nghiệm Dị ứng Toàn diện",
      priority: "P2",
      priorityLabel: "P2 - Cần khám sớm",
      confidence: 94,
      summary:
        "Phát hiện biểu hiện dị ứng. Nên được bác sĩ chuyên khoa dị ứng đánh giá trong ngày.",
    };
  }
  if (respiratory.test(text)) {
    return {
      department: "Khám & Quản lý Hen suyễn - Hô hấp",
      priority: "P2",
      priorityLabel: "P2 - Cần khám sớm",
      confidence: 91,
      summary:
        "Phát hiện triệu chứng hô hấp. Khuyến nghị đo chức năng hô hấp để phân luồng chính xác.",
    };
  }
  if (child.test(text)) {
    return {
      department: "Nhi khoa & Y học Gia đình",
      priority: "P3",
      priorityLabel: "P3 - Khám thông thường",
      confidence: 88,
      summary:
        "Phát hiện biểu hiện liên quan trẻ em. Khuyến nghị khám theo hướng thân thiện gia đình.",
    };
  }
  if (skin.test(text)) {
    return {
      department: "Da liễu & Viêm da Cơ địa",
      priority: "P3",
      priorityLabel: "P3 - Khám thông thường",
      confidence: 84,
      summary:
        "Phát hiện triệu chứng da liễu. Khuyến nghị thăm khám bằng máy soi da Dermoscopy.",
    };
  }
  return {
    department: "Khám Nội Tổng quát & Tầm soát",
    priority: "P3",
    priorityLabel: "P3 - Khám thông thường",
    confidence: 80,
    summary:
      "Phân luồng tổng quát tự động. Khuyến nghị khám nội khoa tổng quát để đánh giá toàn diện.",
  };
}

export interface ActiveAppointment {
  ticketCode: string;
  patientName: string;
  department: string;
  doctor: string;
  room: string;
  date: string;
  timeSlot: string;
}

export const ACTIVE_TICKET: ActiveAppointment = {
  ticketCode: "#APT-2026-8821",
  patientName: "NGUYỄN VĂN AN",
  department: "Khoa Dị ứng & Miễn dịch lâm sàng",
  doctor: "PGS. TS. BS. Trần Minh Tuấn",
  room: "Phòng khám 201",
  date: "Hôm nay",
  timeSlot: "15:30",
};

export const QUEUE_SNAPSHOT = {
  currentServing: "A-101",
  yourTicket: "A-102",
  personsAhead: 1,
  estimateMinutes: 6,
  room: "Phòng khám 201 - PGS.TS.BS Trần Minh Tuấn",
};

export interface PrescriptionRecord {
  medication: string;
  dosage: string;
  frequency: string;
  quantity: string;
  note?: string;
}

export interface PastEncounter {
  id: string;
  date: string;
  department: string;
  physician: string;
  diagnosis: string;
  notes: string;
  prescriptions: PrescriptionRecord[];
  pharmacyReceipt: string;
}

export const PAST_ENCOUNTERS: PastEncounter[] = [
  {
    id: "ENC-2026-0715",
    date: "15/08/2026",
    department: "Xét nghiệm Dị ứng Toàn diện",
    physician: "PGS. TS. BS. Trần Minh Tuấn",
    diagnosis: "Viêm mũi dị ứng (J30.9)",
    notes:
      "Test lẩy da dương tính với mạt bụi nhà (Dermatophagoides pteronyssinus). Tư vấn tránh dị nguyên và sử dụng thuốc xịt corticoid mũi theo lịch.",
    prescriptions: [
      {
        medication: "Amoxicillin 500mg",
        dosage: "500mg x 3 lần/ngày",
        frequency: "Mỗi 8 giờ",
        quantity: "21 viên",
        note: "Uống đủ 7 ngày theo phác đồ.",
      },
      {
        medication: "Paracetamol 500mg",
        dosage: "500mg x 3 lần/ngày",
        frequency: "Mỗi 6-8 giờ khi cần",
        quantity: "10 viên",
        note: "Chỉ dùng khi sốt trên 38,5°C.",
      },
    ],
    pharmacyReceipt: "RX-FHIR-2026-0715-A",
  },
  {
    id: "ENC-2026-0412",
    date: "12/04/2026",
    department: "Khám Nội Tổng quát & Tầm soát",
    physician: "BS. CKI. Nguyễn Văn Dũng",
    diagnosis: "Viêm kết mạc dị ứng theo mùa",
    notes:
      "Ngứa và chảy nước mắt hai bên. Kê thuốc nhỏ mắt kháng histamin; tư vấn chườm lạnh và hạn chế ra ngoài vào giờ phấn hoa cao.",
    prescriptions: [
      {
        medication: "Loratadine 10mg",
        dosage: "10mg x 1 lần/ngày",
        frequency: "Mỗi ngày 1 lần",
        quantity: "14 viên",
        note: "Uống vào buổi tối.",
      },
    ],
    pharmacyReceipt: "RX-FHIR-2026-0412-B",
  },
];

export interface KbEntry {
  id: string;
  keywords: string[];
  answer: string;
  source: string;
}

export const RAG_KNOWLEDGE_BASE: KbEntry[] = [
  {
    id: "bhyt",
    keywords: [
      "bhyt",
      "bao hiem",
      "trai tuyen",
      "tuyen",
      "chi tra",
      "hoan",
      "the",
      "quyen loi",
      "insurance",
    ],
    answer:
      "Theo Chính sách BHYT 2026, phòng khám liên thông BHYT toàn quốc và hỗ trợ người bệnh đi KCB. Trường hợp trái tuyến, phòng khám hỗ trợ làm thủ tục đề nghị thanh toán theo đúng quy định của Bộ Y tế khi có giấy chuyển tuyến hoặc thẻ BHYT hợp lệ. Vui lòng mang thẻ BHYT (bản cứng hoặc VssID) cùng CCCD khi đến.",
    source: "Chính sách BHYT Phòng khám 2026",
  },
  {
    id: "doctor-schedule",
    keywords: [
      "bac si tuan",
      "tran minh tuan",
      "lịch kham",
      "chu nhat",
      "ngay nghi",
      "lich",
      "lam viec",
      "marcus",
    ],
    answer:
      "PGS.TS.BS Trần Minh Tuấn khám tại Phòng khám 201 (Tầng 2) từ 08:00 - 17:30 các ngày. Thứ Bảy chỉ khám buổi sáng, và Chủ Nhật không nhận khám thường kỳ (chỉ trực cấp cứu). Bạn có thể đặt lịch qua mục 'Đội ngũ Bác sĩ' trên trang chủ hoặc gọi tổng đài 1900 123 456.",
    source: "Lịch làm việc Bác sĩ",
  },
  {
    id: "pricing",
    keywords: [
      "gia",
      "bang gia",
      "xet nghiem",
      "dich ung",
      "phi",
      "chi phi",
      "bao gia",
      "gia kham",
      "price",
    ],
    answer:
      "Bảng giá xét nghiệm dị ứng: Gói cơ bản 35 chất - 750.000 VND; Gói mở rộng 60 chất - 1.200.000 VND (đã gồm hẹn đọc kết quả cùng bác sĩ chuyên khoa). Hô hấp ký Spirometry - 350.000 VND. Phí đã bao gồm VAT và được hiển thị minh bạch trước khi xác nhận.",
    source: "Bảng giá dịch vụ Phòng khám Q3/2026",
  },
  {
    id: "booking-procedure",
    keywords: [
      "dat lich",
      "hen",
      "thu tuc",
      "giay to",
      "check in",
      "kiosk",
      "ma qr",
      "quy trinh",
      "quy trình",
      "procedure",
    ],
    answer:
      "Quy trình khám: (1) Đặt lịch online để nhận phiếu QR check-in. (2) Quét QR tại kiosk tầng trệt (chỉ mất 5 giây) để lấy số thứ tự tự động. (3) Làm thủ tục tại quầy tiếp đón và chờ đến lượt. Vui lòng mang theo thẻ BHYT và CCCD để đối soát danh tính.",
    source: "Hướng dẫn quy trình khám Phòng khám v3.1",
  },
  {
    id: "payment",
    keywords: [
      "thanh toan",
      "vietqr",
      "vnpay",
      "the tin dung",
      "tien mat",
      "quay thanh toan",
      "quan vien phi",
      "hoa don",
      "payment",
    ],
    answer:
      "Phòng khám hỗ trợ thanh toán qua mã VietQR tự động, cổng VNPay, thẻ tín dụng/ghi nợ (Visa, Master) và tiền mặt tại quầy viện phí. Phí khám được hiển thị rõ ràng trước khi bạn xác nhận đặt lịch.",
    source: "Chính sách thanh toán Phòng khám 2026",
  },
];

export const BOT_FALLBACK_ANSWER =
  "Cảm ơn bạn đã đặt câu hỏi. Trợ lý ảo chỉ hỗ trợ giải đáp quy trình hành chính (BHYT, đặt lịch, thanh toán, lịch bác sĩ). Vui lòng gọi tổng đài 1900 123 456 hoặc liên hệ nhân viên tiếp đón để được hỗ trợ chi tiết.";
export const BOT_FALLBACK_SOURCE = "Hướng dẫn hỗ trợ Phòng khám";

export function answerFromKnowledgeBase(
  query: string,
): { answer: string; source: string } {
  const normalized = normalizeText(query);
  for (const entry of RAG_KNOWLEDGE_BASE) {
    const matched = entry.keywords.some((keyword) =>
      normalized.includes(normalizeText(keyword)),
    );
    if (matched) return { answer: entry.answer, source: entry.source };
  }
  return { answer: BOT_FALLBACK_ANSWER, source: BOT_FALLBACK_SOURCE };
}

export type TriageAckState = boolean;