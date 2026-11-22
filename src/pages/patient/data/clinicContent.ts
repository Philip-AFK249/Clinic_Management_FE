import {
  Bus,
  CalendarCheck,
  Car,
  Clock,
  FileText,
  MousePointerClick,
  ScanLine,
  Star,
  Stethoscope,
  Users,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Service {
  title: string;
  description: string;
  duration: string;
  icon: LucideIcon;
}

export const CLINIC_SERVICES: Service[] = [
  {
    title: "Khối Nội",
    description:
      "Khám và quản lý bệnh lý nội khoa, tim mạch, chuyển hóa, nhi khoa và tầm soát sức khỏe tổng quát trong cùng một lượt khám.",
    duration: "15-30 phút",
    icon: Stethoscope,
  },
  {
    title: "Khối Ngoại",
    description:
      "Khám ngoại trú, đánh giá hô hấp - dị ứng, tai mũi họng và thực hiện thủ thuật theo chỉ định.",
    duration: "20-30 phút",
    icon: Wind,
  },
];

export interface Metric {
  value: string;
  label: string;
  icon: LucideIcon;
}

export const TRUST_METRICS: Metric[] = [
  {
    value: "4.9/5",
    label: "Đánh giá Google & mức hài lòng đã được xác minh từ bệnh nhân",
    icon: Star,
  },
  {
    value: "15.000+",
    label: "Lượt khám ngoại trú đã hoàn thành",
    icon: Users,
  },
  {
    value: "5 Phút",
    label: "Thời gian chờ trung bình từ Kiosk QR đến Bác sĩ",
    icon: Clock,
  },
  {
    value: "100%",
    label: "Hồ sơ bệnh án điện tử & đơn thuốc điện tử không giấy",
    icon: FileText,
  },
];

export interface WorkflowStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    title: "Khai báo triệu chứng",
    description:
      "Nhập triệu chứng bằng giọng nói hoặc văn bản để AI gợi ý đúng khối khám cần đến.",
    icon: MousePointerClick,
  },
  {
    title: "Quét BHYT / CCCD",
    description:
      "Quét thẻ BHYT hoặc CCCD để xác nhận thông tin và quyền lợi bảo hiểm của bạn.",
    icon: ScanLine,
  },
  {
    title: "Chọn bác sĩ & khung giờ",
    description:
      "Chọn bác sĩ phù hợp và khung giờ trống, nhận phiếu khám điện tử kèm mã QR.",
    icon: CalendarCheck,
  },
  {
    title: "Khám bệnh & nhận đơn điện tử",
    description:
      "Check-in tại kiosk, vào khám và nhận kết quả, đơn thuốc điện tử trong cổng bệnh nhân.",
    icon: FileText,
  },
];

export interface ClinicImage {
  url: string;
  alt: string;
  aspect: string;
}

export const HERO_CONSULTATION_IMAGE: ClinicImage = {
  url: "https://images.squarespace-cdn.com/content/v1/638de650c7378132a12e7c95/44b144e6-000e-4683-ad81-67a3aaf73089/TR4-5-min.jpg",
  alt: "Cuộc trò chuyện ấm áp, đầy tin cậy giữa bác sĩ kỳ cựu và bệnh nhân tại phòng khám.",
  aspect: "aspect-[4/3]",
};

export const CLINIC_FACILITY_IMAGE: ClinicImage = {
  url: "https://www.albanyclinic.ca/wp-content/uploads/2024/10/albany-medical-clinic-walk-in-clinic.jpg",
  alt: "Cơ sở y tế hiện đại, sạch sẽ với khu tiếp đón và văn phòng khám.",
  aspect: "aspect-[16/10]",
};

export interface StaffMember {
  id: string;
  name: string;
  role: "DOCTOR" | "NURSE";
  title: string;
  age: number;
  department: string;
  specialty: string;
  experienceYears: number;
  qualifications: string[];
  languages: string[];
  email: string;
  phone: string;
  extension: string;
  roomNumber: string;
  imageUrl: string;
  availableToday: boolean;
  bio: string;
}

export const MEDICAL_STAFF: StaffMember[] = [
  {
    id: "tran-minh-tuan",
    name: "PGS. TS. BS. Trần Minh Tuấn",
    role: "DOCTOR",
    title: "Bác sĩ Cao cấp - Phó Giáo sư, Tiến sĩ Y khoa",
    age: 52,
    department: "Khối Nội",
    specialty: "Hen phế quản, Dị ứng thuốc & Liệu pháp miễn dịch",
    experienceYears: 24,
    qualifications: ["PGS (Phó Giáo sư)", "TS (Tiến sĩ Y khoa)"],
    languages: ["Tiếng Việt", "Tiếng Anh", "Tiếng Pháp"],
    email: "tuan.tran@smartclinic.vn",
    phone: "+84 (028) 3900 1201",
    extension: "Máy lẻ 101",
    roomNumber: "Phòng khám 101 (Tầng 1)",
    imageUrl:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBr682FWZs0BV7dL-JcrfD6AXLDzubmbjCQ4XEHJjcWhYDGbCtYEL8-os&s=10",
    availableToday: true,
    bio: "Chuyên gia đầu ngành về xét nghiệm lẩy da (Prick Test), dị ứng thời tiết và phác đồ giải mẫn cảm đặc hiệu.",
  },
  {
    id: "nguyen-van-dung",
    name: "BS. CKI. Nguyễn Văn Dũng",
    role: "DOCTOR",
    title: "Bác sĩ Chuyên khoa I",
    age: 44,
    department: "Khối Nội",
    specialty: "Nội tim mạch & Tầm soát bệnh lý chuyển hóa",
    experienceYears: 16,
    qualifications: ["CKI (Chuyên khoa I)"],
    languages: ["Tiếng Việt", "Tiếng Anh"],
    email: "dung.nguyen@smartclinic.vn",
    phone: "+84 (028) 3900 1104",
    extension: "Máy lẻ 102",
    roomNumber: "Phòng khám 102 (Tầng 1)",
    imageUrl:
      "https://content.jdmagicbox.com/v2/comp/hyderabad/m7/040pxx40.xx40.221119220243.t2m7/catalogue/health-care-clinic-dr-muzammil-ahmed-santosh-nagar-hyderabad-clinics-q70ci2fawq.jpg",
    availableToday: true,
    bio: "Hơn 15 năm kinh nghiệm điều trị tăng huyết áp, đái tháo đường và sàng lọc phân luồng bệnh nhân ngoại trú.",
  },
  {
    id: "le-thi-hoang-yen",
    name: "ThS. BS. Lê Thị Hoàng Yến",
    role: "DOCTOR",
    title: "Thạc sĩ, Bác sĩ Chuyên khoa Tai - Mũi - Họng",
    age: 41,
    department: "Khối Ngoại",
    specialty: "Viêm xoang dị ứng, Nội soi thanh quản & Tai mũi họng trẻ em",
    experienceYears: 15,
    qualifications: ["ThS (Thạc sĩ Y khoa)"],
    languages: ["Tiếng Việt", "Tiếng Nga"],
    email: "yen.le@smartclinic.vn",
    phone: "+84 (028) 3900 1205",
    extension: "Máy lẻ 201",
    roomNumber: "Phòng khám 201 (Tầng 2)",
    imageUrl:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_5QbsbX2YbWKJgZlFJhxs8qOjEw1FrCdCepjQi-sHvwrV4KesoqxqIIA&s=10",
    availableToday: true,
    bio: "Bác sĩ điều trị chuyên sâu về viêm mũi dị ứng mạn tính, polyp mũi và các bệnh lý đường hô hấp trên.",
  },
  {
    id: "pham-quoc-bao",
    name: "BS. Phạm Quốc Bảo",
    role: "DOCTOR",
    title: "Bác sĩ Chuyên khoa Nhi",
    age: 38,
    department: "Khối Nội",
    specialty: "Dị ứng đạm sữa bò & Hô hấp nhi khoa",
    experienceYears: 12,
    qualifications: ["BS (Bác sĩ Y khoa)"],
    languages: ["Tiếng Việt", "Tiếng Anh"],
    email: "bao.pham@smartclinic.vn",
    phone: "+84 (028) 3900 1108",
    extension: "Máy lẻ 101",
    roomNumber: "Phòng khám 101 (Tầng 1)",
    imageUrl:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTuCAPQj7GqGxzxy5XysDPR2WuiS7o1U_WR7dIzgAFYppclhcDcEjpO0qc&s=10",
    availableToday: true,
    bio: "Tận tâm trong thăm khám nhẹ nhàng cho trẻ sơ sinh, tư vấn dinh dưỡng và xử lý viêm phế quản co thắt ở trẻ.",
  },
  {
    id: "trinh-thu-hang",
    name: "Y tá Trịnh Thu Hằng",
    role: "NURSE",
    title: "Y tá / Thư ký y khoa",
    age: 37,
    department: "Khối Nội",
    specialty: "Phụ trách Test lẩy da dị ứng & Phân luồng tiếp đón",
    experienceYears: 14,
    qualifications: ["Y tá / Thư ký y khoa"],
    languages: ["Tiếng Việt"],
    email: "hang.trinh@smartclinic.vn",
    phone: "+84 (028) 3900 1011",
    extension: "Máy lẻ 111",
    roomNumber: "Phòng khám 101 (Tầng 1)",
    imageUrl:
      "https://cdn.prod.website-files.com/5babc11099f97ea5dbcf24d5/674e02bfb70719d29df790c2_clinic-nurse.jpg",
    availableToday: true,
    bio: "Hỗ trợ bác sĩ tại phòng khám: đo dấu hiệu sinh tồn, ghi nhận bệnh án và hướng dẫn bệnh nhân trong lượt khám.",
  },
  {
    id: "do-phuong-mai",
    name: "Y tá Đỗ Phương Mai",
    role: "NURSE",
    title: "Y tá / Thư ký y khoa",
    age: 29,
    department: "Khối Nội",
    specialty: "Kỹ thuật tiêm không đau & Hỗ trợ khám Nhi",
    experienceYears: 6,
    qualifications: ["Y tá / Thư ký y khoa"],
    languages: ["Tiếng Việt"],
    email: "mai.do@smartclinic.vn",
    phone: "+84 (028) 3900 1012",
    extension: "Máy lẻ 112",
    roomNumber: "Khu Chăm sóc Nhi (Tầng 1)",
    imageUrl:
      "https://eaglegatecollege.edu/wp-content/uploads/2023/09/shutterstock_2279543395-scaled.jpg",
    availableToday: true,
    bio: "Chuyên viên chăm sóc dịu dàng cho các bệnh nhi, hỗ trợ dán test áp da và theo dõi phản ứng sau tiêm.",
  },
  {
    id: "nguyen-thao-ly",
    name: "Y tá Nguyễn Thảo Ly",
    role: "NURSE",
    title: "Y tá / Thư ký y khoa",
    age: 32,
    department: "Khối Nội",
    specialty: "Theo dõi truyền dịch sinh học & Giải mẫn cảm",
    experienceYears: 8,
    qualifications: ["Y tá / Thư ký y khoa"],
    languages: ["Tiếng Việt"],
    email: "ly.nguyen@smartclinic.vn",
    phone: "+84 (028) 3900 1013",
    extension: "Máy lẻ 113",
    roomNumber: "Phòng Thủ thuật 3 (Tầng 2)",
    imageUrl:
      "https://xpresshealth.co.uk/_next/image?url=https%3A%2F%2Fbackend.xpresshealth.co.uk%2Fuploads%2F2025%2F04%2F513-min.jpg&w=1920&q=100",
    availableToday: true,
    bio: "Giám sát liệu trình nhỏ giọt dưới lưỡi, tiêm vắc xin dị nguyên và sơ cứu phản vệ ngoại viện.",
  },
  {
    id: "tran-kim-oanh",
    name: "Y tá Trần Kim Oanh",
    role: "NURSE",
    title: "Y tá / Thư ký y khoa",
    age: 35,
    department: "Khối Nội",
    specialty: "Hỗ trợ quét BHYT, Kiosk & Sàng lọc ban đầu",
    experienceYears: 11,
    qualifications: ["Y tá / Thư ký y khoa"],
    languages: ["Tiếng Việt"],
    email: "oanh.tran@smartclinic.vn",
    phone: "+84 (028) 3900 1014",
    extension: "Máy lẻ 114",
    roomNumber: "Quầy Điều phối Kiosk (Tầng Trệt)",
    imageUrl:
      "https://media.istockphoto.com/id/2187596982/photo/portrait-of-smiling-african-woman-nurse.jpg?s=612x612&w=0&k=20&c=OC0idN57sR1dpEOCIaBX9ger5rJk9tl5hK7HX-xM8nA=",
    availableToday: true,
    bio: "Hướng dẫn bệnh nhân lớn tuổi lấy số tự động, đối soát thẻ BHYT và hỗ trợ người bệnh khuyết tật.",
  },
];

export interface TransitNote {
  icon: LucideIcon;
  text: string;
}

export interface ClinicLocation {
  name: string;
  address: string;
  phone: string;
  waitTime: string;
  hours: string;
  transit: TransitNote[];
}

export const CLINIC_LOCATIONS: ClinicLocation[] = [
  {
    name: "Cơ sở 1 - Trung tâm Cầu Giấy (Hà Nội)",
    address: "Tòa nhà SmartClinic, 88 Hoàng Đạo Thúy, Cầu Giấy, Hà Nội",
    phone: "(024) 3900 8888",
    waitTime: "~6 phút",
    hours: "Thứ 2 - Chủ Nhật: 07:30 - 20:30 (Khám cả trưa)",
    transit: [
      {
        icon: Car,
        text: "Hầm đỗ xe ô tô & xe máy rộng rãi, vào từ ngõ 88 Hoàng Đạo Thúy",
      },
      {
        icon: Bus,
        text: "Tuyến xe buýt 29, 30, 60B đỗ ngay cổng phòng khám",
      },
    ],
  },
  {
    name: "Cơ sở 2 - Trung tâm Quận 1 (TP. Hồ Chí Minh)",
    address: "120 Hai Bà Trưng, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh",
    phone: "(028) 3900 9999",
    waitTime: "~8 phút",
    hours: "Thứ 2 - Chủ Nhật: 07:30 - 20:30 (Khám cả trưa)",
    transit: [
      {
        icon: Car,
        text: "Bãi đỗ xe máy miễn phí phía sau tòa nhà",
      },
      {
        icon: Bus,
        text: "Gần trạm xe buýt Công viên Lê Văn Tám (cách 100m)",
      },
    ],
  },
];

export interface Faq {
  question: string;
  answer: string;
}

/**
 * How the voice triage gateway's `department_id` maps onto this booking form.
 *
 * The gateway still emits three specialty buckets, while the clinic now books
 * into two blocks. `normalizeTriageDepartments` folds legacy `3` into `1` before
 * the verdict reaches here; the alias below is a defensive fallback.
 */
export const VOICE_TRIAGE_DEPARTMENTS: Record<
  number,
  { serviceIndex: number; ticketPrefix: string; label: string }
> = {
  1: { serviceIndex: 0, ticketPrefix: "#A", label: "Khối Nội" },
  2: { serviceIndex: 1, ticketPrefix: "#B", label: "Khối Ngoại" },
  // Legacy gateway id, kept as an alias so a stale verdict still books into
  // Khối Nội rather than falling through to an unrelated service.
  3: { serviceIndex: 0, ticketPrefix: "#A", label: "Khối Nội" },
};

/** The queue letter for a triage department, or a neutral one when unknown. */
export function ticketPrefixFor(departmentId: number): string {
  return VOICE_TRIAGE_DEPARTMENTS[departmentId]?.ticketPrefix ?? "#N";
}

/**
 * The bookable block a triage department should pre-select. An unrecognised
 * department defaults to Khối Nội, the clinic's general catch-all.
 */
export function serviceIndexForDepartment(departmentId: number): number {
  return VOICE_TRIAGE_DEPARTMENTS[departmentId]?.serviceIndex ?? 0;
}

/**
 * PatientIntakeService's two outpatient blocks, keyed by the `CLINIC_SERVICES`
 * index the booking form actually submits. Legacy department `3` is folded into
 * `Khối Nội`; every consumer uses these same two names.
 */
export const BOOKING_DEPARTMENTS: Record<
  number,
  { departmentId: number; departmentName: string }
> = {
  0: { departmentId: 1, departmentName: "Khối Nội" },
  1: { departmentId: 2, departmentName: "Khối Ngoại" },
};

/** Khối Nội - the catch-all the form falls back to. */
const FALLBACK_BOOKING_DEPARTMENT = {
  departmentId: 1,
  departmentName: "Khối Nội",
};

/**
 * The intake department a chosen service books into.
 *
 * Same fallback as `serviceIndexForDepartment`: an index nobody mapped is a
 * general complaint, not a reason to fail the booking.
 */
export function departmentForServiceIndex(
  serviceIndex: number | null,
): { departmentId: number; departmentName: string } {
  if (serviceIndex === null) return FALLBACK_BOOKING_DEPARTMENT;
  return BOOKING_DEPARTMENTS[serviceIndex] ?? FALLBACK_BOOKING_DEPARTMENT;
}

export function resolveDoctorForService(serviceTitle: string): StaffMember {
  const isExternal = serviceTitle.toLowerCase().includes("ngoại");
  const match = MEDICAL_STAFF.find(
    (staff) =>
      staff.role === "DOCTOR" &&
      staff.department === (isExternal ? "Khối Ngoại" : "Khối Nội"),
  );
  return match ?? MEDICAL_STAFF[0];
}

export const FAQS: Faq[] = [
  {
    question: "Dữ liệu y tế và triệu chứng của tôi có được bảo mật không?",
    answer:
      "Mọi thông tin sức khỏe được mã hóa theo tiêu chuẩn bảo mật y tế ISO 27001 và liên thông chuẩn HL7 FHIR. Chúng tôi cam kết tuyệt đối không chia sẻ dữ liệu cho bên thứ ba.",
  },
  {
    question: "Phòng khám có áp dụng Bảo hiểm Y tế (BHYT) nhà nước không?",
    answer:
      "Có. Phòng khám liên thông dữ liệu BHYT toàn quốc. Bệnh nhân có thể quét thẻ BHYT trên ứng dụng hoặc tại quầy tiếp đón để được hưởng mức chi trả theo đúng quy định của Bộ Y tế.",
  },
  {
    question: "Tôi có thể hủy hoặc đổi giờ hẹn khám không?",
    answer:
      "Bệnh nhân có thể đổi hoặc hủy lịch hẹn hoàn toàn miễn phí trước giờ khám 2 tiếng qua Cổng bệnh nhân hoặc gọi trực tiếp đến tổng đài 1900 123 456.",
  },
  {
    question: "Phòng khám hỗ trợ những hình thức thanh toán nào?",
    answer:
      "Hỗ trợ chuyển khoản quét mã VietQR tự động, thanh toán qua cổng VNPay, thẻ tín dụng/ghi nợ (Visa, Master) và tiền mặt tại quầy viện phí.",
  },
];