export type AdminTab =
  | "OVERVIEW"
  | "TICKET_VERIFICATION"
  | "ROSTER"
  | "USERS"
  | "PATIENTS"
  | "CATALOGS"
  | "AI_GATEWAY";

export type ShiftSession = "MORNING" | "AFTERNOON";

export type DutyType = "OUTPATIENT";

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface Doctor {
  id: string;
  fullName: string;
  title: string;
  roomNumber: string;
  departmentId: string;
  active: boolean;
}

export interface DoctorShift {
  id: string;
  doctorId: string;
  doctorName: string;
  departmentId: string;
  departmentName: string;
  shiftDate: string; // YYYY-MM-DD
  session: ShiftSession;
  dutyType: DutyType;
  maxPatientsPerSlot: number;
}

export interface DoctorSlotLoad {
  doctorId: string;
  doctorName: string;
  title: string;
  roomNumber: string;
  currentPatients: number;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  session: ShiftSession;
  totalCapacity: number;
  bookedCount: number;
  availableCapacity: number;
  isAvailable: boolean;
  doctors: DoctorSlotLoad[];
}

export interface SystemMetrics {
  activeEncounters: number;
  queueDepth: number;
  ocrSuccessRate: number;
  avgAiLatencyMs: number;
  dailyConsultations: number;
  totalRevenueVnd: number;
  encountersDeltaPercent: number;
  triageAccuracyPercent: number;
}

export interface StaffAccount {
  id: string;
  fullName: string;
  email: string;
  role: "DOCTOR" | "PHARMACIST" | "NURSE" | "ADMIN";
  department: string;
  departmentId?: string;
  title?: string;
  roomNumber?: string;
  phone: string;
  status: "ACTIVE" | "SUSPENDED";
  lastLogin: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: "BHYT_POLICY" | "PRICING" | "DOCTOR_SCHEDULE" | "CLINIC_GUIDE";
  contentSnippet: string;
  chunkCount: number;
  embeddingModel: string;
  updatedAt: string;
  status: "INDEXED" | "SYNCING" | "STALE";
}

export interface HospitalCode {
  code: string;
  name: string;
  copayPercent: number;
}

export interface DrugItem {
  id: string;
  name: string;
  concentration: string;
  unitPrice: number;
  stockUnits: number;
  bhytCoverage: "BHYT 80%" | "BHYT 100%" | "Tự túc";
}

export interface ServiceFee {
  id: string;
  code: string;
  name: string;
  price: number;
  bhytCovered: boolean;
}

export interface InfrastructureService {
  name: string;
  status: "operational" | "degraded" | "down";
  latencyMs?: number;
}

export interface TriageDistribution {
  level: string;
  count: number;
  color: string;
  bgColor: string;
}

export const MOCK_SYSTEM_METRICS: SystemMetrics = {
  activeEncounters: 42,
  queueDepth: 17,
  ocrSuccessRate: 98.5,
  avgAiLatencyMs: 820,
  dailyConsultations: 128,
  totalRevenueVnd: 187500000,
  encountersDeltaPercent: 12,
  triageAccuracyPercent: 96.2,
};

export const MOCK_DEPARTMENTS: Department[] = [
  { id: "DEP-INT", code: "INT", name: "Khối Nội" },
  { id: "DEP-EXT", code: "EXT", name: "Khối Ngoại" },
];

export const MOCK_DOCTORS: Doctor[] = [
  {
    id: "D001",
    fullName: "PGS. TS. BS. Trần Minh Tuấn",
    title: "PGS.TS",
    roomNumber: "Phòng 201",
    departmentId: "DEP-EXT",
    active: true,
  },
  {
    id: "D002",
    fullName: "BS. CKI. Nguyễn Văn Dũng",
    title: "BS.CKI",
    roomNumber: "Phòng 104",
    departmentId: "DEP-INT",
    active: true,
  },
  {
    id: "D003",
    fullName: "ThS. BS. Phạm Thị Hoa",
    title: "ThS.BS",
    roomNumber: "Phòng 105",
    departmentId: "DEP-INT",
    active: true,
  },
  {
    id: "D004",
    fullName: "BS. CKI. Lê Văn Bảo",
    title: "BS.CKI",
    roomNumber: "Phòng 301",
    departmentId: "DEP-INT",
    active: true,
  },
  {
    id: "D005",
    fullName: "BS. Nguyễn Thanh Hà",
    title: "BS",
    roomNumber: "Phòng 302",
    departmentId: "DEP-INT",
    active: true,
  },
  {
    id: "D006",
    fullName: "BS. CKI. Trần Quốc Khánh",
    title: "BS.CKI",
    roomNumber: "Phòng 401",
    departmentId: "DEP-INT",
    active: true,
  },
  {
    id: "D007",
    fullName: "ThS. BS. Đỗ Thu Vân",
    title: "ThS.BS",
    roomNumber: "Phòng 402",
    departmentId: "DEP-INT",
    active: true,
  },
  {
    id: "D008",
    fullName: "BS. CKI. Hoàng Kim Ngân",
    title: "BS.CKI",
    roomNumber: "Phòng 501",
    departmentId: "DEP-EXT",
    active: true,
  },
  {
    id: "D009",
    fullName: "BS. Vũ Đức Minh",
    title: "BS",
    roomNumber: "Phòng 202",
    departmentId: "DEP-EXT",
    active: true,
  },
  {
    id: "D010",
    fullName: "BS. CKI. Ngô Bá Khôi",
    title: "BS.CKI",
    roomNumber: "Phòng 502",
    departmentId: "DEP-EXT",
    active: true,
  },
  {
    id: "D011",
    fullName: "BS. Lê Thị Ngọc",
    title: "BS",
    roomNumber: "Phòng 106",
    departmentId: "DEP-INT",
    active: true,
  },
];

function getDepartmentName(departmentId: string): string {
  return MOCK_DEPARTMENTS.find((d) => d.id === departmentId)?.name ?? departmentId;
}

export const MOCK_STAFF: StaffAccount[] = [
  // --- 1 System Admin ---
  {
    id: "STF-001",
    fullName: "Quản trị viên Hệ thống",
    email: "admin@smartclinic.vn",
    role: "ADMIN",
    department: "Phòng Quản trị & CNTT",
    phone: "0901000001",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:50",
  },
  // --- Doctors - Khối Nội (Department ID 1) ---
  {
    id: "STF-002",
    fullName: "PGS. TS. BS. Trần Minh Tuấn",
    email: "tuan.tran@smartclinic.vn",
    role: "DOCTOR",
    department: "Khối Nội",
    departmentId: "1",
    title: "PGS.TS",
    roomNumber: "Phòng 101",
    phone: "0902000001",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:02",
  },
  {
    id: "STF-003",
    fullName: "BS. CKI. Nguyễn Văn Dũng",
    email: "dung.nguyen@smartclinic.vn",
    role: "DOCTOR",
    department: "Khối Nội",
    departmentId: "1",
    title: "BS.CKI",
    roomNumber: "Phòng 102",
    phone: "0902000002",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:45",
  },
  {
    id: "STF-004",
    fullName: "ThS. BS. Phạm Quốc Bảo",
    email: "bao.pham@smartclinic.vn",
    role: "DOCTOR",
    department: "Khối Nội",
    departmentId: "1",
    title: "ThS.BS",
    roomNumber: "Phòng 101",
    phone: "0902000003",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:15",
  },
  // --- Doctors - Khối Ngoại (Department ID 2) ---
  {
    id: "STF-005",
    fullName: "BS. CKI. Lê Thị Hoàng Yến",
    email: "yen.le@smartclinic.vn",
    role: "DOCTOR",
    department: "Khối Ngoại",
    departmentId: "2",
    title: "BS.CKI",
    roomNumber: "Phòng 201",
    phone: "0902000004",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:05",
  },
  {
    id: "STF-006",
    fullName: "BS. CKII. Phạm Thị Hoa",
    email: "hoa.pham@smartclinic.vn",
    role: "DOCTOR",
    department: "Khối Ngoại",
    departmentId: "2",
    title: "BS.CKII",
    roomNumber: "Phòng 202",
    phone: "0902000005",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:20",
  },
  {
    id: "STF-007",
    fullName: "ThS. BS. Hoàng Hoài Nam",
    email: "nam.hoang@smartclinic.vn",
    role: "DOCTOR",
    department: "Khối Ngoại",
    departmentId: "2",
    title: "ThS.BS",
    roomNumber: "Phòng 201",
    phone: "0902000006",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:55",
  },
  // --- Doctors - Khối Nội (legacy department 3, merged into 1) ---
  {
    id: "STF-008",
    fullName: "BS. CKI. Nguyễn Thị Lan",
    email: "lan.nguyen@smartclinic.vn",
    role: "DOCTOR",
    department: "Khối Nội",
    departmentId: "1",
    title: "BS.CKI",
    roomNumber: "Phòng 205",
    phone: "0902000007",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:10",
  },
  {
    id: "STF-009",
    fullName: "ThS. BS. Vũ Minh Đức",
    email: "duc.vu@smartclinic.vn",
    role: "DOCTOR",
    department: "Khối Nội",
    departmentId: "1",
    title: "ThS.BS",
    roomNumber: "Phòng 206",
    phone: "0902000008",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:30",
  },
  {
    id: "STF-010",
    fullName: "BS. Mai Thu Hương",
    email: "huong.mai@smartclinic.vn",
    role: "DOCTOR",
    department: "Khối Nội",
    departmentId: "1",
    title: "BS",
    roomNumber: "Phòng 205",
    phone: "0902000009",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:25",
  },
  // --- Y tá / Thư ký y khoa - Khối Nội ---
  {
    id: "STF-011",
    fullName: "Y tá Trịnh Thu Hằng",
    email: "hang.trinh@smartclinic.vn",
    role: "NURSE",
    department: "Y tá / Thư ký y khoa",
    title: "Y tá / Thư ký y khoa",
    roomNumber: "Phòng khám 101",
    phone: "0903000001",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:28",
  },
  {
    id: "STF-012",
    fullName: "Y tá Đỗ Phương Mai",
    email: "mai.do@smartclinic.vn",
    role: "NURSE",
    department: "Y tá / Thư ký y khoa",
    title: "Y tá / Thư ký y khoa",
    roomNumber: "Phòng khám 201",
    phone: "0903000002",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:32",
  },
  {
    id: "STF-013",
    fullName: "Y tá Nguyễn Thảo Ly",
    email: "ly.nguyen@smartclinic.vn",
    role: "NURSE",
    department: "Y tá / Thư ký y khoa",
    title: "Y tá / Thư ký y khoa",
    roomNumber: "Phòng khám 205",
    phone: "0903000003",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:40",
  },
  // --- Thủ thuật / Cận lâm sàng ---
  {
    id: "STF-014",
    fullName: "Y tá Trần Kim Oanh",
    email: "oanh.tran@smartclinic.vn",
    role: "NURSE",
    department: "Y tá / Thư ký y khoa",
    title: "Y tá / Thư ký y khoa",
    roomNumber: "Phòng Cấp cứu & Điện tim",
    phone: "0903000004",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:35",
  },
  {
    id: "STF-015",
    fullName: "Y tá Lê Phương Thảo",
    email: "thao.le@smartclinic.vn",
    role: "NURSE",
    department: "Y tá / Thư ký y khoa",
    title: "Y tá / Thư ký y khoa",
    roomNumber: "Phòng khám 205 (Tầng 2)",
    phone: "0903000005",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:42",
  },
  {
    id: "STF-016",
    fullName: "Y tá Phạm Yến Nhi",
    email: "nhi.pham@smartclinic.vn",
    role: "NURSE",
    department: "Y tá / Thư ký y khoa",
    title: "Y tá / Thư ký y khoa",
    roomNumber: "Buồng Tiểu phẫu & Laser da",
    phone: "0903000006",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:48",
  },
  // --- Tiếp đón / Kiosk ---
  {
    id: "STF-017",
    fullName: "Y tá Vũ Thùy Linh",
    email: "linh.vu@smartclinic.vn",
    role: "NURSE",
    department: "Tiếp đón & Kiosk",
    title: "Y tá / Thư ký y khoa",
    roomNumber: "Quầy Tiếp đón Sảnh A",
    phone: "0903000007",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:20",
  },
  {
    id: "STF-018",
    fullName: "Y tá Bùi Ánh Ngọc",
    email: "ngoc.bui@smartclinic.vn",
    role: "NURSE",
    department: "Tiếp đón & Kiosk",
    title: "Y tá / Thư ký y khoa",
    roomNumber: "Khu Kiosk Tự phục vụ",
    phone: "0903000008",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:22",
  },
  {
    id: "STF-019",
    fullName: "Y tá Hoàng Bích Trâm",
    email: "tram.hoang@smartclinic.vn",
    role: "NURSE",
    department: "Tiếp đón & Kiosk",
    title: "Y tá / Thư ký y khoa",
    roomNumber: "Bàn Đo Dấu hiệu Sinh tồn",
    phone: "0903000009",
    status: "ACTIVE",
    lastLogin: "22/09/2026 07:25",
  },
  // --- 6 Pharmacists - Dược sĩ Đại học (Duyệt đơn / Dược lâm sàng) ---
  {
    id: "STF-020",
    fullName: "DS. Đặng Thu Thảo",
    email: "thao.dang@smartclinic.vn",
    role: "PHARMACIST",
    department: "Dược lâm sàng & Duyệt đơn",
    title: "DS",
    roomNumber: "Quầy Dược Lâm Sàng #1",
    phone: "0904000001",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:00",
  },
  {
    id: "STF-021",
    fullName: "DS. Nguyễn Trung Kiên",
    email: "kien.nguyen@smartclinic.vn",
    role: "PHARMACIST",
    department: "Dược lâm sàng & Duyệt đơn",
    title: "DS",
    roomNumber: "Quầy Dược Lâm Sàng #2",
    phone: "0904000002",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:05",
  },
  // --- Dược sĩ Cao đẳng (Cấp phát & Đóng gói) ---
  {
    id: "STF-022",
    fullName: "DSCĐ. Trần Thanh Hà",
    email: "ha.tran@smartclinic.vn",
    role: "PHARMACIST",
    department: "Cấp phát & Đóng gói",
    title: "DSCĐ",
    roomNumber: "Cửa phát thuốc BHYT #1",
    phone: "0904000003",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:10",
  },
  {
    id: "STF-023",
    fullName: "DSCĐ. Lê Hoàng Long",
    email: "long.le@smartclinic.vn",
    role: "PHARMACIST",
    department: "Cấp phát & Đóng gói",
    title: "DSCĐ",
    roomNumber: "Cửa phát thuốc BHYT #2",
    phone: "0904000004",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:12",
  },
  {
    id: "STF-024",
    fullName: "DSCĐ. Đỗ Hồng Phúc",
    email: "phuc.do@smartclinic.vn",
    role: "PHARMACIST",
    department: "Cấp phát & Đóng gói",
    title: "DSCĐ",
    roomNumber: "Cửa phát thuốc Thu phí #1",
    phone: "0904000005",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:15",
  },
  {
    id: "STF-025",
    fullName: "DSCĐ. Vũ Cẩm Nhung",
    email: "nhung.vu@smartclinic.vn",
    role: "PHARMACIST",
    department: "Cấp phát & Đóng gói",
    title: "DSCĐ",
    roomNumber: "Cửa phát thuốc Thu phí #2",
    phone: "0904000006",
    status: "ACTIVE",
    lastLogin: "22/09/2026 08:18",
  },
];

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekDates(anchor: Date = new Date()): string[] {
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const weekday = monday.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  monday.setDate(monday.getDate() + diff);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return toISODate(day);
  });
}

function buildMockDoctorShifts(): DoctorShift[] {
  const week = getWeekDates();
  const shifts: DoctorShift[] = [];
  let sequence = 0;

  function shift(weekday: number, seed: Omit<DoctorShift, "id" | "shiftDate">) {
    sequence += 1;
    shifts.push({
      ...seed,
      id: `DRSHIFT-${String(sequence).padStart(3, "0")}`,
      shiftDate: week[weekday],
    });
  }

  // --- DEP-EXT (Khối Ngoại) ---
  // Thứ 2: Sáng có BS trực, Chiều chưa phân BS
  shift(0, {
    doctorId: "D001",
    doctorName: "PGS. TS. BS. Trần Minh Tuấn",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(0, {
    doctorId: "D009",
    doctorName: "BS. Vũ Đức Minh",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  shift(0, {
    doctorId: "D001",
    doctorName: "PGS. TS. BS. Trần Minh Tuấn",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  // Thứ 4: Sáng có BS trực, Chiều chưa phân BS
  shift(2, {
    doctorId: "D001",
    doctorName: "PGS. TS. BS. Trần Minh Tuấn",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(2, {
    doctorId: "D009",
    doctorName: "BS. Vũ Đức Minh",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  shift(2, {
    doctorId: "D001",
    doctorName: "PGS. TS. BS. Trần Minh Tuấn",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  // Thứ 5 chiều: có BS trực
  shift(3, {
    doctorId: "D009",
    doctorName: "BS. Vũ Đức Minh",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  shift(4, {
    doctorId: "D001",
    doctorName: "PGS. TS. BS. Trần Minh Tuấn",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });

  // --- DEP-INT (Khối Nội) ---
  // Thứ 2: Sáng 3 BS (capacity 8), Chiều đủ chuẩn
  shift(0, {
    doctorId: "D002",
    doctorName: "BS. CKI. Nguyễn Văn Dũng",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(0, {
    doctorId: "D011",
    doctorName: "BS. Lê Thị Ngọc",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(0, {
    doctorId: "D003",
    doctorName: "ThS. BS. Phạm Thị Hoa",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  shift(0, {
    doctorId: "D002",
    doctorName: "BS. CKI. Nguyễn Văn Dũng",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(0, {
    doctorId: "D003",
    doctorName: "ThS. BS. Phạm Thị Hoa",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  // Thứ 3: Sáng + Chiều đều đủ chuẩn
  shift(1, {
    doctorId: "D002",
    doctorName: "BS. CKI. Nguyễn Văn Dũng",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(1, {
    doctorId: "D003",
    doctorName: "ThS. BS. Phạm Thị Hoa",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  shift(1, {
    doctorId: "D002",
    doctorName: "BS. CKI. Nguyễn Văn Dũng",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(1, {
    doctorId: "D003",
    doctorName: "ThS. BS. Phạm Thị Hoa",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  // Thứ 4 chiều: có BS trực
  shift(2, {
    doctorId: "D002",
    doctorName: "BS. CKI. Nguyễn Văn Dũng",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  // Thứ 5 + Thứ 6: Sáng đủ chuẩn
  shift(3, {
    doctorId: "D002",
    doctorName: "BS. CKI. Nguyễn Văn Dũng",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(3, {
    doctorId: "D003",
    doctorName: "ThS. BS. Phạm Thị Hoa",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  shift(4, {
    doctorId: "D002",
    doctorName: "BS. CKI. Nguyễn Văn Dũng",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(4, {
    doctorId: "D003",
    doctorName: "ThS. BS. Phạm Thị Hoa",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });

  // --- DEP-INT (Khối Nội) ---
  // Thứ 2: Sáng có BS trực, Chiều chưa phân BS
  shift(0, {
    doctorId: "D004",
    doctorName: "BS. CKI. Lê Văn Bảo",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(0, {
    doctorId: "D005",
    doctorName: "BS. Nguyễn Thanh Hà",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  shift(0, {
    doctorId: "D004",
    doctorName: "BS. CKI. Lê Văn Bảo",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  // Thứ 5: Sáng có BS trực, Chiều chưa phân BS
  shift(3, {
    doctorId: "D004",
    doctorName: "BS. CKI. Lê Văn Bảo",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(3, {
    doctorId: "D005",
    doctorName: "BS. Nguyễn Thanh Hà",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  shift(3, {
    doctorId: "D004",
    doctorName: "BS. CKI. Lê Văn Bảo",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });

  // --- DEP-INT (Nhi) ---
  // Thứ 2: Sáng đủ, Chiều trống
  shift(0, {
    doctorId: "D006",
    doctorName: "BS. CKI. Trần Quốc Khánh",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(0, {
    doctorId: "D007",
    doctorName: "ThS. BS. Đỗ Thu Vân",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  // Thứ 3: Sáng có BS trực, Chiều có BS trực
  shift(1, {
    doctorId: "D006",
    doctorName: "BS. CKI. Trần Quốc Khánh",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(1, {
    doctorId: "D007",
    doctorName: "ThS. BS. Đỗ Thu Vân",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  shift(1, {
    doctorId: "D007",
    doctorName: "ThS. BS. Đỗ Thu Vân",
    departmentId: "DEP-INT",
    departmentName: getDepartmentName("DEP-INT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });

  // --- DEP-EXT (Tai Mũi Họng) ---
  // Thứ 2: Sáng và chiều chưa đạt chuẩn mở khám
  shift(0, {
    doctorId: "D008",
    doctorName: "BS. CKI. Hoàng Kim Ngân",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(0, {
    doctorId: "D008",
    doctorName: "BS. CKI. Hoàng Kim Ngân",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  shift(0, {
    doctorId: "D010",
    doctorName: "BS. CKI. Ngô Bá Khôi",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "AFTERNOON",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });
  // Thứ 6: Sáng đủ chuẩn
  shift(4, {
    doctorId: "D008",
    doctorName: "BS. CKI. Hoàng Kim Ngân",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 4,
  });
  shift(4, {
    doctorId: "D010",
    doctorName: "BS. CKI. Ngô Bá Khôi",
    departmentId: "DEP-EXT",
    departmentName: getDepartmentName("DEP-EXT"),
    session: "MORNING",
    dutyType: "OUTPATIENT",
    maxPatientsPerSlot: 3,
  });

  return shifts;
}

export const MOCK_DOCTOR_SHIFTS: DoctorShift[] = buildMockDoctorShifts();

export const MOCK_KNOWLEDGE_BASE: KnowledgeDocument[] = [
  {
    id: "KB-001",
    title: "Chính sách BHYT Phòng khám 2026",
    category: "BHYT_POLICY",
    contentSnippet:
      "Quy định mức hưởng BHYT đúng tuyến 80%, trái tuyến 40%. Hồ sơ giấy tờ cần thiết: Thẻ BHYT photo, CCCD/CMND, Giấy giới thiệu (nếu có).",
    chunkCount: 12,
    embeddingModel: "text-embedding-3-small (1536d)",
    updatedAt: "10/09/2026",
    status: "INDEXED",
  },
  {
    id: "KB-002",
    title: "Bảng giá dịch vụ & Xét nghiệm Khối Ngoại Q3/2026",
    category: "PRICING",
    contentSnippet:
      "Xét nghiệm IgE Total: 250.000đ. Test lẩy Da (Prick Test) 12 allergen: 480.000đ. Consultation Specialist: 350.000đ.",
    chunkCount: 8,
    embeddingModel: "text-embedding-3-small (1536d)",
    updatedAt: "08/09/2026",
    status: "INDEXED",
  },
  {
    id: "KB-003",
    title: "Lịch công tác Bác sĩ Tuần này",
    category: "DOCTOR_SCHEDULE",
    contentSnippet:
      "PGS.TS Trần Minh Tuấn: Thứ 2, 4, 6 (Sáng 7h-11h). BS.CKI Nguyễn Văn Dũng: Thứ 2-6 (Cả ngày). BSCK2 Phạm Thị Hoa: Thứ 3, 5 (Chiều 13h-17h).",
    chunkCount: 6,
    embeddingModel: "text-embedding-3-small (1536d)",
    updatedAt: "10/09/2026",
    status: "INDEXED",
  },
  {
    id: "KB-004",
    title: "Quy trình Tiếp đón Kiosk & Check-in QR v3.1",
    category: "CLINIC_GUIDE",
    contentSnippet:
      "Bước 1: Quét mã QR tại Kiosk. Bước 2: Xác thực CCCD/Thẻ BHYT qua PaddleOCR. Bước 3: Chọn khối khám. Bước 4: In phiếu & chuyển hàng đợi.",
    chunkCount: 15,
    embeddingModel: "text-embedding-3-small (1536d)",
    updatedAt: "05/09/2026",
    status: "INDEXED",
  },
];

export const MOCK_HOSPITAL_CODES: HospitalCode[] = [
  { code: "79-014", name: "BV Đa khoa Sài Gòn", copayPercent: 20 },
  { code: "01-002", name: "BV Bạch Mai", copayPercent: 20 },
  { code: "79-021", name: "BV Nhi Đồng 2", copayPercent: 20 },
  { code: "79-018", name: "BV FV", copayPercent: 40 },
  { code: "01-001", name: "BV Trung ương Huế", copayPercent: 40 },
];

export const MOCK_DRUGS: DrugItem[] = [
  {
    id: "DRG-001",
    name: "Amoxicillin",
    concentration: "500mg",
    unitPrice: 15000,
    stockUnits: 2400,
    bhytCoverage: "BHYT 80%",
  },
  {
    id: "DRG-002",
    name: "Cefuroxime",
    concentration: "500mg",
    unitPrice: 35000,
    stockUnits: 1200,
    bhytCoverage: "BHYT 80%",
  },
  {
    id: "DRG-003",
    name: "Paracetamol",
    concentration: "500mg",
    unitPrice: 3000,
    stockUnits: 5000,
    bhytCoverage: "BHYT 100%",
  },
  {
    id: "DRG-004",
    name: "Cetirizine",
    concentration: "10mg",
    unitPrice: 8000,
    stockUnits: 1800,
    bhytCoverage: "BHYT 80%",
  },
  {
    id: "DRG-005",
    name: "Prednisolone",
    concentration: "5mg",
    unitPrice: 5000,
    stockUnits: 900,
    bhytCoverage: "BHYT 80%",
  },
  {
    id: "DRG-006",
    name: "Ventolin Inhaler",
    concentration: "100mcg",
    unitPrice: 95000,
    stockUnits: 350,
    bhytCoverage: "Tự túc",
  },
];

export const MOCK_SERVICE_FEES: ServiceFee[] = [
  { id: "SVC-001", code: "CONS-GEN", name: "Khám Tổng quát", price: 150000, bhytCovered: true },
  { id: "SVC-002", code: "CONS-SPC", name: "Khám Khối Ngoại", price: 350000, bhytCovered: true },
  { id: "SVC-003", code: "LAB-IGE", name: "Xét nghiệm IgE Total", price: 250000, bhytCovered: true },
  { id: "SVC-004", code: "LAB-PRICK", name: "Test lẩy Da (Prick Test 12 allergen)", price: 480000, bhytCovered: false },
  { id: "SVC-005", code: "LAB-SPT", name: "Test lẩy Da mở rộng (Extended Panel)", price: 620000, bhytCovered: false },
  { id: "SVC-006", code: "IMG-XQ", name: "Chụp X-Quang Ngực", price: 300000, bhytCovered: true },
];

export const MOCK_INFRA_SERVICES: InfrastructureService[] = [
  { name: "Patient Service (Node.js)", status: "operational", latencyMs: 12 },
  { name: "Doctor EHR Service (Node.js)", status: "operational", latencyMs: 18 },
  { name: "AI Gateway (Python/FastAPI)", status: "operational", latencyMs: 820 },
  { name: "Redis Sentinel", status: "operational", latencyMs: 2 },
  { name: "PostgreSQL 16 + pgvector", status: "operational", latencyMs: 8 },
  { name: "PaddleOCR Worker", status: "operational", latencyMs: 340 },
];

export const MOCK_TRIAGE_DISTRIBUTION: TriageDistribution[] = [
  { level: "P1 - Cấp cứu", count: 3, color: "text-triage-p1", bgColor: "bg-triage-p1-bg" },
  { level: "P2 - Khẩn trương", count: 11, color: "text-triage-p2", bgColor: "bg-triage-p2-bg" },
  { level: "P3 - Thường quy", count: 28, color: "text-triage-p3", bgColor: "bg-triage-p3-bg" },
];

export const CATEGORY_LABELS: Record<KnowledgeDocument["category"], string> = {
  BHYT_POLICY: "Chính sách BHYT",
  PRICING: "Bảng giá",
  DOCTOR_SCHEDULE: "Lịch trực",
  CLINIC_GUIDE: "Quy trình",
};

export const ROLE_LABELS: Record<StaffAccount["role"], string> = {
  DOCTOR: "Bác sĩ",
  PHARMACIST: "Dược sĩ",
  NURSE: "Y tá / Thư ký y khoa",
  ADMIN: "Quản trị viên",
};

export const SHIFT_SESSION_LABELS: Record<ShiftSession, string> = {
  MORNING: "Sáng (07:30 - 11:30)",
  AFTERNOON: "Chiều (13:00 - 17:00)",
};

export const SHIFT_SESSION_SHORT_LABELS: Record<ShiftSession, string> = {
  MORNING: "Sáng",
  AFTERNOON: "Chiều",
};

export const DUTY_TYPE_LABELS: Record<DutyType, string> = {
  OUTPATIENT: "Khám ngoại trú",
};

export const DOCTOR_TITLE_OPTIONS = ["PGS.TS", "BS.CKI", "BS.CKII", "ThS.BS", "BS"] as const;

export const MAX_PATIENTS_PER_SLOT = 4;

export interface SlotDefinition {
  startTime: string;
  endTime: string;
}

export const MORNING_SLOTS: SlotDefinition[] = [
  { startTime: "07:30", endTime: "08:30" },
  { startTime: "08:30", endTime: "09:30" },
  { startTime: "09:30", endTime: "10:30" },
  { startTime: "10:30", endTime: "11:30" },
];

export const AFTERNOON_SLOTS: SlotDefinition[] = [
  { startTime: "13:00", endTime: "14:00" },
  { startTime: "14:00", endTime: "15:00" },
  { startTime: "15:00", endTime: "16:00" },
  { startTime: "16:00", endTime: "17:00" },
];

function seededInt(seed: string, max: number): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % (max + 1);
}

function distributePatientLoad(
  doctors: Doctor[],
  bookedCount: number,
  seed: string,
): DoctorSlotLoad[] {
  const loads: DoctorSlotLoad[] = doctors.map((doctor) => ({
    doctorId: doctor.id,
    doctorName: doctor.fullName,
    title: doctor.title,
    roomNumber: doctor.roomNumber,
    currentPatients: 0,
  }));
  if (loads.length === 0 || bookedCount === 0) {
    return loads;
  }
  let index = seededInt(seed, Math.max(loads.length - 1, 0)) % loads.length;
  let remaining = bookedCount;
  while (remaining > 0) {
    loads[index % loads.length].currentPatients += 1;
    index += 1;
    remaining -= 1;
  }
  return loads;
}

export function buildTimeSlots(
  shiftDate: string,
  departmentId: string,
  shifts: DoctorShift[],
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  function buildForSession(session: ShiftSession) {
    const slotDefinitions =
      session === "MORNING" ? MORNING_SLOTS : AFTERNOON_SLOTS;
    const outpatientDoctors = shifts
      .filter(
        (s) =>
          s.shiftDate === shiftDate &&
          s.departmentId === departmentId &&
          s.session === session &&
          s.dutyType === "OUTPATIENT",
      )
      .map((s) => MOCK_DOCTORS.find((d) => d.id === s.doctorId))
      .filter((d): d is Doctor => Boolean(d));
    const totalCapacity =
      outpatientDoctors.length * MAX_PATIENTS_PER_SLOT;

    for (const definition of slotDefinitions) {
      const seed = `${shiftDate}::${departmentId}::${session}::${definition.startTime}`;
      const bookedCount =
        totalCapacity === 0 ? 0 : seededInt(seed, totalCapacity);
      slots.push({
        startTime: definition.startTime,
        endTime: definition.endTime,
        session,
        totalCapacity,
        bookedCount,
        availableCapacity: totalCapacity - bookedCount,
        isAvailable: bookedCount < totalCapacity,
        doctors: distributePatientLoad(outpatientDoctors, bookedCount, seed),
      });
    }
  }

  buildForSession("MORNING");
  buildForSession("AFTERNOON");

  return slots;
}