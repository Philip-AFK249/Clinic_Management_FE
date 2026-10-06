import {
  Baby,
  Bus,
  Car,
  Clock,
  Droplets,
  FileText,
  HeartPulse,
  Microscope,
  MousePointerClick,
  QrCode,
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
    title: "Xét nghiệm Dị ứng Toàn diện",
    description:
      "Thực hiện test lẩy da (Prick test) và test áp da (Patch test) chẩn đoán dị ứng thức ăn, hóa chất, phấn hoa. Kết quả có trong ngày.",
    duration: "20-30 phút",
    icon: Droplets,
  },
  {
    title: "Khám & Quản lý Hen suyễn - Hô hấp",
    description:
      "Đo chức năng hô hấp (Hô hấp ký Spirometry), lập kế hoạch kiểm soát cơn hen và phác đồ phòng ngừa tái phát.",
    duration: "15-20 phút",
    icon: Wind,
  },
  {
    title: "Nhi khoa & Y học Gia đình",
    description:
      "Thăm khám thân thiện, nhẹ nhàng cho trẻ sơ sinh và trẻ nhỏ. Tư vấn dinh dưỡng, tiêm chủng và sàng lọc dị ứng sớm.",
    duration: "20-30 phút",
    icon: Baby,
  },
  {
    title: "Khám Nội Tổng quát & Tầm soát",
    description:
      "Khám chuyên sâu các bệnh lý nội khoa, tăng huyết áp, đái tháo đường, gan mật và phân loại sàng lọc trước điều trị.",
    duration: "15-30 phút",
    icon: Stethoscope,
  },
  {
    title: "Da liễu & Viêm da Cơ địa",
    description:
      "Chẩn đoán mề đay mạn tính, chàm sữa, viêm da tiếp xúc bằng máy soi da Dermoscopy kỹ thuật số.",
    duration: "20 phút",
    icon: Microscope,
  },
  {
    title: "Khám Sức khỏe Tổng quát Định kỳ",
    description:
      "Gói xét nghiệm máu toàn diện, siêu âm ổ bụng, điện tim ECG và tư vấn bệnh án điện tử paperless.",
    duration: "30-45 phút",
    icon: HeartPulse,
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
    title: "Bước 1: Khai báo triệu chứng hoặc Chọn bác sĩ",
    description:
      "Nhập triệu chứng (bằng giọng nói hoặc gõ chữ) để Trợ lý AI định hướng đúng chuyên khoa cần khám.",
    icon: MousePointerClick,
  },
  {
    title: "Bước 2: Nhận Vé khám điện tử & Mã QR",
    description:
      "Nhận xác nhận lịch hẹn tức thì qua tin nhắn và mã QR cá nhân hiển thị trên màn hình.",
    icon: QrCode,
  },
  {
    title: "Bước 3: Check-in Kiosk 5 giây tại sảnh",
    description:
      "Quét mã QR tại máy Kiosk khi đến phòng khám để nhận số thứ tự tự động và vào thẳng phòng khám.",
    icon: ScanLine,
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
    department: "Khoa Dị ứng & Miễn dịch lâm sàng",
    specialty: "Hen phế quản, Dị ứng thuốc & Liệu pháp miễn dịch",
    experienceYears: 24,
    qualifications: ["PGS (Phó Giáo sư)", "TS (Tiến sĩ Y khoa)"],
    languages: ["Tiếng Việt", "Tiếng Anh", "Tiếng Pháp"],
    email: "tuan.tran@smartclinic.vn",
    phone: "+84 (028) 3900 1201",
    extension: "Máy lẻ 201",
    roomNumber: "Phòng khám 201 (Tầng 2)",
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
    department: "Khoa Nội Tổng quát",
    specialty: "Nội tim mạch & Tầm soát bệnh lý chuyển hóa",
    experienceYears: 16,
    qualifications: ["CKI (Chuyên khoa I)"],
    languages: ["Tiếng Việt", "Tiếng Anh"],
    email: "dung.nguyen@smartclinic.vn",
    phone: "+84 (028) 3900 1104",
    extension: "Máy lẻ 104",
    roomNumber: "Phòng khám 104 (Tầng 1)",
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
    department: "Khoa Tai - Mũi - Họng",
    specialty: "Viêm xoang dị ứng, Nội soi thanh quản & Tai mũi họng trẻ em",
    experienceYears: 15,
    qualifications: ["ThS (Thạc sĩ Y khoa)"],
    languages: ["Tiếng Việt", "Tiếng Nga"],
    email: "yen.le@smartclinic.vn",
    phone: "+84 (028) 3900 1205",
    extension: "Máy lẻ 205",
    roomNumber: "Phòng khám 205 (Tầng 2)",
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
    department: "Khoa Nhi & Y học Gia đình",
    specialty: "Dị ứng đạm sữa bò & Hô hấp nhi khoa",
    experienceYears: 12,
    qualifications: ["BS (Bác sĩ Y khoa)"],
    languages: ["Tiếng Việt", "Tiếng Anh"],
    email: "bao.pham@smartclinic.vn",
    phone: "+84 (028) 3900 1108",
    extension: "Máy lẻ 108",
    roomNumber: "Phòng khám 108 (Tầng 1)",
    imageUrl:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTuCAPQj7GqGxzxy5XysDPR2WuiS7o1U_WR7dIzgAFYppclhcDcEjpO0qc&s=10",
    availableToday: true,
    bio: "Tận tâm trong thăm khám nhẹ nhàng cho trẻ sơ sinh, tư vấn dinh dưỡng và xử lý viêm phế quản co thắt ở trẻ.",
  },
  {
    id: "trinh-thu-hang",
    name: "ĐD. Trịnh Thu Hằng, CNĐD",
    role: "NURSE",
    title: "Điều dưỡng Trưởng",
    age: 37,
    department: "Khối Chẩn đoán & Thăm dò chức năng",
    specialty: "Phụ trách Test lẩy da dị ứng & Phân luồng tiếp đón",
    experienceYears: 14,
    qualifications: ["CNĐD (Cử nhân Điều dưỡng)"],
    languages: ["Tiếng Việt"],
    email: "hang.trinh@smartclinic.vn",
    phone: "+84 (028) 3900 1011",
    extension: "Máy lẻ 111",
    roomNumber: "Trạm Điều dưỡng A (Tầng 1)",
    imageUrl:
      "https://cdn.prod.website-files.com/5babc11099f97ea5dbcf24d5/674e02bfb70719d29df790c2_clinic-nurse.jpg",
    availableToday: true,
    bio: "Phụ trách quy trình an toàn tiêm dị nguyên, đo dấu hiệu sinh tồn và hướng dẫn bệnh nhân trước khi vào khám.",
  },
  {
    id: "do-phuong-mai",
    name: "ĐD. Đỗ Phương Mai",
    role: "NURSE",
    title: "Cử nhân Điều dưỡng Nhi khoa",
    age: 29,
    department: "Phòng Tiêm chủng & Chăm sóc Nhi",
    specialty: "Kỹ thuật tiêm không đau & Hỗ trợ khám Nhi",
    experienceYears: 6,
    qualifications: ["CNĐD (Cử nhân Điều dưỡng)"],
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
    name: "ĐD. Nguyễn Thảo Ly",
    role: "NURSE",
    title: "Cử nhân Điều dưỡng Hồi sức",
    age: 32,
    department: "Phòng Điều trị & Truyền thuốc trong ngày",
    specialty: "Theo dõi truyền dịch sinh học & Giải mẫn cảm",
    experienceYears: 8,
    qualifications: ["CNĐD (Cử nhân Điều dưỡng)"],
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
    name: "ĐD. Trần Kim Oanh",
    role: "NURSE",
    title: "Điều dưỡng Điều phối Kiosk",
    age: 35,
    department: "Quầy Tiếp đón & Phân luồng Cấp cứu",
    specialty: "Hỗ trợ quét BHYT, Kiosk & Sàng lọc ban đầu",
    experienceYears: 11,
    qualifications: ["ĐD (Điều dưỡng)"],
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
 * The gateway triages into three buckets, while `CLINIC_SERVICES` is a list of six
 * bookable services, so the mapping is a projection, not a lookup: `serviceIndex`
 * is the service the dispatcher pre-selects, and `ticketPrefix` is the queue
 * letter the reception desk stamps on the printed ticket.
 *
 * `department_id` is the key rather than `department_name` because the name is
 * free text the LLM writes ("Khoa Hô hấp và Dị ứng", "Phòng Da liễu"), and will
 * not match a fixed string.
 *
 * The one genuinely lossy row is `2`, which merges two bookable services. It
 * points at the allergy service, because the complaints that reach it are
 * overwhelmingly allergic rhinitis and urticaria rather than asthma - but it is a
 * guess, and the patient can still change the service on the next step.
 */
export const VOICE_TRIAGE_DEPARTMENTS: Record<
  number,
  { serviceIndex: number; ticketPrefix: string; label: string }
> = {
  1: { serviceIndex: 3, ticketPrefix: "#A", label: "Nội tổng quát" },
  2: { serviceIndex: 0, ticketPrefix: "#B", label: "Hô hấp & Dị ứng" },
  3: { serviceIndex: 4, ticketPrefix: "#C", label: "Da liễu" },
};

/** The queue letter for a triage department, or a neutral one when unknown. */
export function ticketPrefixFor(departmentId: number): string {
  return VOICE_TRIAGE_DEPARTMENTS[departmentId]?.ticketPrefix ?? "#N";
}

/**
 * The bookable service a triage department should pre-select.
 *
 * Falls back to general medicine rather than to index 0 (the allergy panel): an
 * unrecognised department is most often a general complaint the LLM labelled
 * unconventionally, and a specific test panel is the wrong default.
 */
export function serviceIndexForDepartment(departmentId: number): number {
  return VOICE_TRIAGE_DEPARTMENTS[departmentId]?.serviceIndex ?? 3;
}

export function resolveDoctorForService(serviceTitle: string): StaffMember {
  const title = serviceTitle.toLowerCase();
  const match = MEDICAL_STAFF.find((staff) => {
    const haystack = `${staff.department} ${staff.title}`.toLowerCase();
    if (title.includes("nhi khoa") || title.includes("y học gia đình"))
      return haystack.includes("nhi");
    if (title.includes("nội tổng quát") || title.includes("sức khỏe tổng quát"))
      return haystack.includes("nội tổng quát");
    if (title.includes("hô hấp") || title.includes("hen suyễn"))
      return haystack.includes("dị ứng");
    if (title.includes("dị ứng") || title.includes("da liễu"))
      return haystack.includes("dị ứng");
    return false;
  });
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