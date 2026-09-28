export type TriageLevel = "P1" | "P2" | "P3";
export type BookingSource =
  | "Kiosk QR"
  | "Kiosk OCR"
  | "Quầy tiếp đón"
  | "Ứng dụng Bệnh nhân";
export type Gender = "Nam" | "Nữ" | "Khác";
export type BhyCoverage = "BHYT 80%" | "BHYT 100%" | "Tự túc";

export interface Allergy {
  name: string;
  severity: "SEVERE" | "MODERATE";
  reaction: string;
}

export interface Vitals {
  bp: string;
  hr: number;
  temp: string;
  spo2: number;
}

export interface PastEncounter {
  id: string;
  date: string;
  department: string;
  complaint: string;
  diagnosis: string;
  notes: string;
}

export interface LabReport {
  id: string;
  name: string;
  result: string;
  status: "Normal" | "Abnormal" | "Pending";
  date: string;
}

export interface ScannedPrescription {
  id: string;
  date: string;
  medication: string;
  dosage: string;
  ocrConfidence: number;
}

export interface PatientRecord {
  ticketNumber: string;
  name: string;
  patientId: string;
  dob: string;
  age: number;
  gender: Gender;
  insuranceCode: string;
  initialHospitalCode: string;
  isOcrVerified: boolean;
  arrivalTime: string;
  waitingMinutes: number;
  chiefComplaint: string;
  source: BookingSource;
  triage: TriageLevel;
  priorityScore: number;
  disclaimerAccepted: boolean;
  allergies: Allergy[];
  /**
   * Set to false when the source genuinely has no allergy data, so the UI can
   * say "unknown" rather than implying the patient has no known allergies.
   * Omitted by the seeded mock records, which are treated as complete.
   */
  allergiesKnown?: boolean;
  vitals: Vitals;
  /** Same idea as `allergiesKnown`, for not-yet-measured vitals. */
  vitalsRecorded?: boolean;
  pastEncounters: PastEncounter[];
  labReports: LabReport[];
  scannedOldPrescriptions: ScannedPrescription[];
}

const NGUYEN_VAN_AN: PatientRecord = {
  ticketNumber: "#A-102",
  name: "NGUYỄN VĂN AN",
  patientId: "FHIR-P-88219",
  dob: "14/08/1984",
  age: 42,
  gender: "Nam",
  insuranceCode: "DN 4 79 79 12345678",
  initialHospitalCode: "79-014 (BV Đa Khoa Sài Gòn)",
  isOcrVerified: true,
  arrivalTime: "08:42",
  waitingMinutes: 4,
  chiefComplaint: "Sốt cao 38.5°C, nuốt đau rát họng 2 ngày nay, khó nuốt, không ho",
  source: "Kiosk QR",
  triage: "P1",
  priorityScore: 150,
  disclaimerAccepted: true,
  allergies: [
    { name: "Penicillin", severity: "SEVERE", reaction: "Sốc phản vệ" },
    { name: "Hải sản", severity: "SEVERE", reaction: "Dị ứng nặng" },
  ],
  vitals: { bp: "125/82", hr: 78, temp: "38.2°C", spo2: 98 },
  pastEncounters: [
    {
      id: "FHIR-ENC-8815",
      date: "15/08/2026",
      department: "Khoa Dị ứng & Miễn dịch lâm sàng",
      complaint: "Tái khám viêm mũi dị ứng mạn tính",
      diagnosis: "J30.9 - Viêm mũi dị ứng mạn tính",
      notes: "Kê Loratadine 10mg/ngày. Khuyến cáo tránh dị nguyên mạt bụi nhà.",
    },
    {
      id: "FHIR-ENC-8802",
      date: "27/02/2026",
      department: "Khoa Dị ứng & Miễn dịch lâm sàng",
      complaint: "Mề đay dị ứng sau bữa ăn hải sản",
      diagnosis: "L50.0 - Mề đay do thức ăn dị ứng",
      notes: "Nhập viện điều trị kháng histamin. Khuyến cáo tuyệt đối tránh hải sản.",
    },
    {
      id: "FHIR-ENC-8771",
      date: "05/11/2025",
      department: "Khám Sức khỏe Tổng quát",
      complaint: "Tầm soát sức khỏe định kỳ năm 2025",
      diagnosis: "Z00.00 - Khám tổng quát người lớn",
      notes: "Các chỉ số trong giới hạn bình thường. Khuyến nghị tập thể dục đều đặn.",
    },
  ],
  labReports: [
    {
      id: "LAB-2210",
      name: "Tổng phân tích máu (CBC)",
      result: "WBC 11.2 x10^9/L (tăng nhẹ)",
      status: "Abnormal",
      date: "27/02/2026",
    },
    {
      id: "LAB-2211",
      name: "CRP - Protein phản ứng C",
      result: "18 mg/L (tăng nhẹ)",
      status: "Abnormal",
      date: "27/02/2026",
    },
    {
      id: "LAB-2190",
      name: "IgE toàn phần huyết thanh",
      result: "214 IU/mL (mức giới hạn)",
      status: "Normal",
      date: "15/08/2026",
    },
  ],
  scannedOldPrescriptions: [
    {
      id: "OCR-PRX-8815",
      date: "15/08/2026",
      medication: "Loratadine 10mg",
      dosage: "1 viên/ngày (buổi tối)",
      ocrConfidence: 98,
    },
    {
      id: "OCR-PRX-8802",
      date: "27/02/2026",
      medication: "Cetirizine 10mg",
      dosage: "1 viên/ngày x 5 ngày",
      ocrConfidence: 96,
    },
    {
      id: "OCR-PRX-8802B",
      date: "27/02/2026",
      medication: "Methylprednisolone 16mg",
      dosage: "2 viên/ngày x 3 ngày, giảm dần",
      ocrConfidence: 93,
    },
  ],
};

const QUEUE_SEED: PatientRecord[] = [
  {
    ticketNumber: "#A-101",
    name: "Trần Thị Mai",
    patientId: "FHIR-P-88107",
    dob: "02/03/1968",
    age: 58,
    gender: "Nữ",
    insuranceCode: "DN 4 96 79 55512345",
    initialHospitalCode: "79-014 (BV Đa Khoa Sài Gòn)",
    isOcrVerified: false,
    arrivalTime: "08:36",
    waitingMinutes: 6,
    chiefComplaint: "Khó thở cấp, rít thanh quản, ho khan kéo dài 2 ngày",
    source: "Ứng dụng Bệnh nhân",
    triage: "P1",
    priorityScore: 128,
    disclaimerAccepted: true,
    allergies: [
      { name: "Aspirin", severity: "MODERATE", reaction: "Dị ứng vừa" },
    ],
    vitals: { bp: "138/88", hr: 92, temp: "38.6°C", spo2: 94 },
    pastEncounters: [
      {
        id: "FHIR-ENC-8788",
        date: "19/04/2026",
        department: "Khoa Hô hấp & Hen suyễn",
        complaint: "Cơn hen suyễn cấp",
        diagnosis: "J45.901 - Hen suyễn không đặc hiệu",
        notes: "Hướng dẫn kỹ thuật bình xịt; bổ sung duy trì Budesonide.",
      },
    ],
    labReports: [
      {
        id: "LAB-2205",
        name: "Lưu lượng đỉnh (Peak Flow)",
        result: "310 L/min (68% mức cá nhân)",
        status: "Abnormal",
        date: "19/04/2026",
      },
    ],
    scannedOldPrescriptions: [
      {
        id: "OCR-PRX-8788",
        date: "19/04/2026",
        medication: "Budesonide 200mcg bình xịt",
        dosage: "2 nhịp xịt x 2 lần/ngày",
        ocrConfidence: 95,
      },
    ],
  },
  {
    ticketNumber: "#A-103",
    name: "Lê Hoàng Nam",
    patientId: "FHIR-P-88202",
    dob: "09/07/1991",
    age: 35,
    gender: "Nam",
    insuranceCode: "DN 4 79 79 00234567",
    initialHospitalCode: "79-014 (BV Đa Khoa Sài Gòn)",
    isOcrVerified: false,
    arrivalTime: "08:51",
    waitingMinutes: 9,
    chiefComplaint: "Phát ban ngứa lan tỏa toàn thân sau uống kháng sinh",
    source: "Ứng dụng Bệnh nhân",
    triage: "P2",
    priorityScore: 95,
    disclaimerAccepted: true,
    allergies: [],
    vitals: { bp: "118/76", hr: 74, temp: "36.9°C", spo2: 99 },
    pastEncounters: [],
    labReports: [],
    scannedOldPrescriptions: [],
  },
  {
    ticketNumber: "#A-105",
    name: "Bùi Đức Minh",
    patientId: "FHIR-P-88044",
    dob: "22/11/2014",
    age: 12,
    gender: "Nam",
    insuranceCode: "DN 4 79 79 33456789",
    initialHospitalCode: "79-014 (BV Đa Khoa Sài Gòn)",
    isOcrVerified: true,
    arrivalTime: "08:29",
    waitingMinutes: 12,
    chiefComplaint: "Đau họng, viêm amidan hốc mủ nhẹ",
    source: "Ứng dụng Bệnh nhân",
    triage: "P3",
    priorityScore: 60,
    disclaimerAccepted: true,
    allergies: [
      { name: "Đậu phộng", severity: "SEVERE", reaction: "Sốc phản vệ" },
    ],
    vitals: { bp: "110/70", hr: 88, temp: "37.8°C", spo2: 98 },
    pastEncounters: [],
    labReports: [],
    scannedOldPrescriptions: [],
  },
  {
    ticketNumber: "#A-104",
    name: "Phạm Thu Hương",
    patientId: "FHIR-P-88231",
    dob: "12/01/1959",
    age: 67,
    gender: "Nữ",
    insuranceCode: "DN 5 79 79 77881234",
    initialHospitalCode: "79-014 (BV Đa Khoa Sài Gòn)",
    isOcrVerified: false,
    arrivalTime: "08:58",
    waitingMinutes: 2,
    chiefComplaint: "Tái khám định kỳ dị ứng thời tiết và nhận thuốc",
    source: "Kiosk QR",
    triage: "P3",
    priorityScore: 44,
    disclaimerAccepted: true,
    allergies: [],
    vitals: { bp: "140/85", hr: 76, temp: "36.8°C", spo2: 97 },
    pastEncounters: [
      {
        id: "FHIR-ENC-8766",
        date: "08/02/2026",
        department: "Khoa Dị ứng & Miễn dịch lâm sàng",
        complaint: "Liệu pháp miễn dịch duy trì - tuần 12",
        diagnosis: "Z07.9 - Chăm sóc sau điều trị",
        notes: "Tiếp tục liệu pháp miễn dịch dưới lưỡi; không ghi nhận phản ứng.",
      },
    ],
    labReports: [],
    scannedOldPrescriptions: [
      {
        id: "OCR-PRX-8766",
        date: "08/02/2026",
        medication: "Cetirizine 10mg",
        dosage: "1 viên/ngày",
        ocrConfidence: 94,
      },
    ],
  },
];

export const ACTIVE_PATIENT = NGUYEN_VAN_AN;

export const QUEUE_PATIENTS: PatientRecord[] = QUEUE_SEED;

export const TRIAGE_LABELS: Record<TriageLevel, string> = {
  P1: "P1 - Khẩn cấp",
  P2: "P2 - Cần khám sớm",
  P3: "P3 - Khám thường",
};

export type SpeakerRole = "DOCTOR" | "PATIENT";

export type TranscriptEntityType =
  | "SYMPTOM"
  | "DURATION"
  | "VITALS"
  | "ALLERGY";

export interface TranscriptEntity {
  type: TranscriptEntityType;
  term: string;
}

export interface TranscriptLine {
  id: string;
  speaker: SpeakerRole;
  timeOffset: string;
  text: string;
  entities: TranscriptEntity[];
}

export const TRANSCRIPT_LINES: TranscriptLine[] = [
  {
    id: "L1",
    speaker: "DOCTOR",
    timeOffset: "00:00",
    text: "Chào anh An, mời anh ngồi. Hôm nay trong người thấy khó chịu ở đâu vậy anh?",
    entities: [],
  },
  {
    id: "L2",
    speaker: "PATIENT",
    timeOffset: "00:04",
    text: "Chào bác sĩ, tôi bị đau rát cổ họng với nuốt nước bọt thấy đau buốt khoảng 2 hôm nay rồi.",
    entities: [
      { type: "SYMPTOM", term: "đau rát cổ họng" },
      { type: "DURATION", term: "2 hôm nay" },
    ],
  },
  {
    id: "L3",
    speaker: "DOCTOR",
    timeOffset: "00:09",
    text: "Anh có bị sốt lạnh run hay khó thở gì từ hôm qua đến giờ không?",
    entities: [],
  },
  {
    id: "L4",
    speaker: "PATIENT",
    timeOffset: "00:13",
    text: "Có bác sĩ, sáng nay tôi đo nhiệt độ ở nhà là 38.5 độ C, họng đau rát tăng lên khi nuốt.",
    entities: [
      { type: "VITALS", term: "38.5 độ C" },
      { type: "SYMPTOM", term: "họng đau rát" },
    ],
  },
  {
    id: "L5",
    speaker: "DOCTOR",
    timeOffset: "00:18",
    text: "Để tôi kiểm tra họng cho anh. Trước đây anh có tiền sử dị ứng với thuốc hay thức ăn gì không?",
    entities: [],
  },
  {
    id: "L6",
    speaker: "PATIENT",
    timeOffset: "00:22",
    text: "Có, tôi bị dị ứng nặng với kháng sinh nhóm Penicillin và tôm cua biển.",
    entities: [
      { type: "ALLERGY", term: "Penicillin" },
      { type: "ALLERGY", term: "tôm cua biển" },
    ],
  },
  {
    id: "L7",
    speaker: "DOCTOR",
    timeOffset: "00:26",
    text: "Tôi ghi nhận rồi. Họng anh đỏ rực, hai amidan sưng nhẹ nhưng chưa có giả mạc. Tôi sẽ tuyệt đối tránh kháng sinh nhóm Penicillin cho anh.",
    entities: [{ type: "SYMPTOM", term: "amidan sưng nhẹ" }],
  },
];

export interface SoapDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export const AI_SOAP_DRAFT: SoapDraft = {
  subjective:
    "Bệnh nhân nam 42 tuổi, đến khám vì đau rát họng và nuốt đau 2 ngày nay. Sốt cao 38.5°C đo tại nhà sáng nay. Đau tăng khi nuốt nước bọt và thức ăn đặc. Không ho, không khó thở, không phát ban. Tiền sử dị ứng: Penicillin (phản vệ độ 2) và Hải sản.",
  objective:
    "Huyết áp: 125/82 mmHg, Mạch: 78 ck/phút, Nhiệt độ: 38.2°C, SpO2: 98%. Họng đỏ rực lan tỏa, niêm mạc xung huyết. Amidan 2 bên sưng to độ I-II, không có giả mạc mủ. Hạch góc hàm hai bên sưng nhẹ 1cm, ấn đau nhẹ. Tim đều, phổi trong không rale.",
  assessment:
    "J02.9 - Viêm họng cấp tính, không đặc hiệu (Theo dõi căn nguyên virus bội nhiễm vi khuẩn). Cảnh báo: Dị ứng Penicillin mức độ nặng — chống chỉ định tuyệt đối nhóm Beta-lactam.",
  plan:
    "1) Chống chỉ định toàn bộ kháng sinh nhóm Penicillin. 2) Cân nhắc kháng sinh thay thế an toàn nếu triệu chứng nhiễm khuẩn tiến triển. 3) Paracetamol 500mg hạ sốt giảm đau khi sốt > 38.5°C. 4) Súc họng bằng nước muối sinh lý ấm 4 lần/ngày, uống nhiều nước ấm, nghỉ ngơi. 5) Tái khám sau 48-72 giờ nếu sốt không hạ.",
};

export interface IcdCode {
  code: string;
  label: string;
  confidence: number;
}

export const AI_ICD_SUGGESTIONS: IcdCode[] = [
  { code: "J02.9", label: "Viêm họng cấp tính, không đặc hiệu", confidence: 94 },
  {
    code: "J00",
    label: "Viêm mũi họng cấp [cảm thường]",
    confidence: 68,
  },
];

export const ICD10_FORMULARY: IcdCode[] = [
  {
    code: "J02.8",
    label: "Viêm họng cấp do vi sinh vật khác xác định",
    confidence: 0,
  },
  { code: "J03.9", label: "Viêm amidan cấp, không đặc hiệu", confidence: 0 },
  {
    code: "J45.901",
    label: "Hen suyễn không đặc hiệu có cơn cấp",
    confidence: 0,
  },
  { code: "R11.2", label: "Buồn nôn kèm nôn", confidence: 0 },
  { code: "J30.1", label: "Viêm mũi dị ứng do phấn hoa", confidence: 0 },
  { code: "L50.0", label: "Mề đay dị ứng", confidence: 0 },
  {
    code: "K21.0",
    label: "Trào ngược dạ dày - thực quản có viêm thực quản",
    confidence: 0,
  },
  { code: "R50.9", label: "Sốt, không đặc hiệu", confidence: 0 },
];

export interface FormularyMed {
  name: string;
  dosageForm: string;
  defaultFrequency: string;
  defaultDuration: string;
  stockUnits: number;
  bhytCoverage: BhyCoverage;
  isPenicillinClass?: boolean;
}

export const PHARMACY_FORMULARY: FormularyMed[] = [
  {
    name: "Amoxicillin 500mg",
    dosageForm: "Viên nang",
    defaultFrequency: "1 viên x 2 lần/ngày sau ăn",
    defaultDuration: "7 ngày",
    stockUnits: 140,
    bhytCoverage: "BHYT 80%",
    isPenicillinClass: true,
  },
  {
    name: "Paracetamol 500mg",
    dosageForm: "Viên nén",
    defaultFrequency: "1 viên mỗi 6 giờ khi sốt > 38.5°C",
    defaultDuration: "3 ngày",
    stockUnits: 250,
    bhytCoverage: "BHYT 100%",
  },
  {
    name: "Cefuroxime 500mg",
    dosageForm: "Viên nén",
    defaultFrequency: "1 viên x 2 lần/ngày",
    defaultDuration: "7 ngày",
    stockUnits: 60,
    bhytCoverage: "BHYT 80%",
  },
  {
    name: "Loratadine 10mg",
    dosageForm: "Viên nén",
    defaultFrequency: "1 viên/ngày",
    defaultDuration: "30 ngày",
    stockUnits: 24,
    bhytCoverage: "BHYT 80%",
  },
  {
    name: "Budesonide 200mcg",
    dosageForm: "Bình xịt định liều",
    defaultFrequency: "2 nhịp xịt x 2 lần/ngày",
    defaultDuration: "30 ngày",
    stockUnits: 18,
    bhytCoverage: "Tự túc",
  },
];

export interface RxLine {
  id: string;
  medication: string;
  dosageForm: string;
  routeFrequency: string;
  duration: string;
  quantity: number;
  stockUnits: number;
  bhytCoverage: BhyCoverage;
  isPenicillinClass?: boolean;
}

export const AI_RX_DRAFT: RxLine[] = [
  {
    id: "RX-1",
    medication: "Amoxicillin 500mg",
    dosageForm: "Viên nang",
    routeFrequency: "1 viên x 2 lần/ngày sau ăn",
    duration: "7 ngày",
    quantity: 14,
    stockUnits: 140,
    bhytCoverage: "BHYT 80%",
    isPenicillinClass: true,
  },
  {
    id: "RX-2",
    medication: "Paracetamol 500mg",
    dosageForm: "Viên nén",
    routeFrequency: "1 viên mỗi 6 giờ khi sốt > 38.5°C",
    duration: "3 ngày",
    quantity: 10,
    stockUnits: 250,
    bhytCoverage: "BHYT 100%",
  },
];

export const ENCOUNTER_ID = "FHIR-ENC-8821";