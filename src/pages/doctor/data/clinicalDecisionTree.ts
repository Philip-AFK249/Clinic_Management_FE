/**
 * Outpatient clinical decision tree rendered by `ClinicalDecisionTree`.
 *
 * Four specialty branches mirror the two-block clinic structure, but stay
 * granular enough for the doctor to drill into the common conditions seen in
 * the exam room. Every disease exposes the same four leaf groups:
 *  - S: patient-reported symptoms appended to SOAP `subjective`
 *  - O: examination findings appended to SOAP `objective`
 *  - P: investigations / care instructions appended to SOAP `plan`
 *  - Rx: catalog keywords matched against the live in-stock formulary
 *
 * The tree is intentionally data-only: selection/removal logic lives in the
 * component so this file stays easy to review and extend.
 */

export interface SuggestedDrug {
  /** Case/diacritic-insensitive fragment matched against `DrugDto.name`. */
  keyword: string;
  routeFrequency: string;
  duration: string;
  quantity: number;
}

export interface ClinicalDiseaseNode {
  /** ICD-10 code shown in the badge and stored on the encounter. */
  code: string;
  name: string;
  subjectiveSymptoms: string[];
  objectiveFindings: string[];
  clinicalPlans: string[];
  suggestedDrugs: SuggestedDrug[];
}

export interface ClinicalSpecialtyBranch {
  id: string;
  name: string;
  description: string;
  diseases: ClinicalDiseaseNode[];
}

export const CLINICAL_DECISION_TREE: ClinicalSpecialtyBranch[] = [
  {
    id: "CARDIO",
    name: "Tim mạch & Nội tổng quát",
    description: "Tăng huyết áp, đau thắt ngực, đái tháo đường, gút, dạ dày.",
    diseases: [
      {
        code: "I10",
        name: "Tăng huyết áp nguyên phát",
        subjectiveSymptoms: [
          "Đau đầu vùng chẩm về sáng",
          "Chóng mặt, hoa mắt khi thay đổi tư thế",
          "Không triệu chứng, phát hiện khi đo huyết áp",
        ],
        objectiveFindings: [
          "Huyết áp ≥ 140/90 mmHg ở 2 lần đo",
          "Mạch đều, không tiếng thổi bệnh lý",
          "Không có dấu hiệu suy tim cấp",
        ],
        clinicalPlans: [
          "Đo huyết áp 2 tay, theo dõi huyết áp 24 giờ",
          "Xét nghiệm điện giải đồ, creatinin, lipid máu",
          "Tư vấn giảm muối dưới 5g/ngày, vận động 30 phút/ngày",
        ],
        suggestedDrugs: [
          {
            keyword: "amlodipine",
            routeFrequency: "1 viên/ngày buổi sáng",
            duration: "30 ngày",
            quantity: 30,
          },
        ],
      },
      {
        code: "I20.9",
        name: "Cơn đau thắt ngực ổn định",
        subjectiveSymptoms: [
          "Đau ngực sau xương ức khi gắng sức",
          "Đau lan vai trái hoặc hàm, giảm khi nghỉ",
          "Khó thở khi leo cầu thang",
        ],
        objectiveFindings: [
          "Đau ngực tái lặp cùng mức gắng sức",
          "ECG có thể bình thường hoặc ST chênh xuống",
          "Không có dấu hiệu nhồi máu cấp",
        ],
        clinicalPlans: [
          "ECG 12 chuyển đạo trong cơn đau",
          "Siêu âm tim, nghiệm pháp gắng sức",
          "Tư vấn ngừng thuốc lá, kiểm soát huyết áp và mỡ máu",
        ],
        suggestedDrugs: [
          {
            keyword: "bisoprolol",
            routeFrequency: "1 viên/ngày buổi sáng",
            duration: "30 ngày",
            quantity: 30,
          },
          {
            keyword: "atorvastatin",
            routeFrequency: "1 viên/ngày buổi tối",
            duration: "30 ngày",
            quantity: 30,
          },
        ],
      },
      {
        code: "E11",
        name: "Đái tháo đường típ 2",
        subjectiveSymptoms: [
          "Khát nhiều, tiểu nhiều, sụt cân",
          "Mờ mắt, tê bì đầu chi",
          "Vết thương lâu lành",
        ],
        objectiveFindings: [
          "Glucose mao mạch tăng, HbA1c ≥ 6.5%",
          "BMI tăng, béo bụng",
          "Giảm cảm giác chi dưới",
        ],
        clinicalPlans: [
          "HbA1c, glucose đói, chức năng thận, albumin niệu",
          "Soi đáy mắt và khám bàn chân",
          "Tư vấn dinh dưỡng, vận động và theo dõi đường huyết",
        ],
        suggestedDrugs: [
          {
            keyword: "metformin",
            routeFrequency: "1 viên x 2 lần/ngày sau ăn",
            duration: "30 ngày",
            quantity: 60,
          },
        ],
      },
      {
        code: "M10",
        name: "Cơn gút cấp",
        subjectiveSymptoms: [
          "Đau dữ dội khớp bàn ngón chân cái về đêm",
          "Khớp sưng nóng đỏ",
          "Tiền sử tăng acid uric",
        ],
        objectiveFindings: [
          "Khớp MTP1 sưng, nóng, đỏ, đau",
          "Không sốt hoặc chỉ sốt nhẹ",
          "Tophi ở tai hoặc khớp",
        ],
        clinicalPlans: [
          "Acid uric máu, CRP, công thức máu",
          "X-quang khớp bàn chân",
          "Tư vấn uống đủ nước, hạn chế bia rượu và hải sản",
        ],
        suggestedDrugs: [
          {
            keyword: "colchicine",
            routeFrequency: "1 viên x 2 lần/ngày",
            duration: "5 ngày",
            quantity: 10,
          },
        ],
      },
      {
        code: "K21",
        name: "Trào ngược dạ dày - thực quản",
        subjectiveSymptoms: [
          "Ợ nóng, ợ chua sau ăn",
          "Đau rát sau xương ức",
          "Ho khan, khàn tiếng về đêm",
        ],
        objectiveFindings: [
          "Ấn đau thượng vị nhẹ",
          "Không có dấu hiệu xuất huyết tiêu hóa",
          "Niêm mạc họng sung huyết",
        ],
        clinicalPlans: [
          "Nội soi dạ dày nếu có dấu hiệu cảnh báo",
          "Thử nghiệm PPI trong 4 tuần",
          "Tư vấn nằm đầu cao, tránh ăn đêm",
        ],
        suggestedDrugs: [
          {
            keyword: "omeprazole",
            routeFrequency: "1 viên/ngày trước ăn sáng",
            duration: "30 ngày",
            quantity: 30,
          },
        ],
      },
      {
        code: "K25",
        name: "Loét dạ dày - tá tràng",
        subjectiveSymptoms: [
          "Đau thượng vị âm ỉ, liên quan bữa ăn",
          "Buồn nôn, đầy bụng",
          "Phân đen hoặc nôn ra máu (dấu hiệu cảnh báo)",
        ],
        objectiveFindings: [
          "Ấn đau thượng vị",
          "Có thể thiếu máu nếu chảy máu",
          "Không đề kháng thành bụng",
        ],
        clinicalPlans: [
          "Nội soi tiêu hóa trên, test H. pylori",
          "Công thức máu, ferritin",
          "Tư vấn tránh NSAID, rượu và thuốc lá",
        ],
        suggestedDrugs: [
          {
            keyword: "omeprazole",
            routeFrequency: "1 viên x 2 lần/ngày trước ăn",
            duration: "14 ngày",
            quantity: 28,
          },
        ],
      },
    ],
  },
  {
    id: "RESP",
    name: "Hô hấp & Tai Mũi Họng",
    description: "Viêm họng, mũi xoang, dị ứng, phế quản, hen, tai giữa.",
    diseases: [
      {
        code: "J02",
        name: "Viêm họng cấp",
        subjectiveSymptoms: [
          "Đau rát họng, nuốt đau",
          "Sốt nhẹ, ho khan",
          "Khàn tiếng",
        ],
        objectiveFindings: [
          "Họng đỏ, amidan sưng",
          "Hạch cổ nhỏ, di động",
          "Không có mủ amidan",
        ],
        clinicalPlans: [
          "Test nhanh strep nếu có chỉ định",
          "Súc họng nước muối, uống nước ấm",
          "Theo dõi sốt và dấu hiệu khó thở",
        ],
        suggestedDrugs: [
          {
            keyword: "paracetamol",
            routeFrequency: "1 viên x 3 lần/ngày khi sốt",
            duration: "5 ngày",
            quantity: 15,
          },
        ],
      },
      {
        code: "J01",
        name: "Viêm mũi xoang cấp",
        subjectiveSymptoms: [
          "Nghẹt mũi, chảy nước mũi đục",
          "Đau vùng trán hoặc gò má",
          "Giảm khứu giác",
        ],
        objectiveFindings: [
          "Niêm mạc mũi sung huyết, có dịch mủ",
          "Ấn đau xoang trán và xoang hàm",
          "Sốt nhẹ",
        ],
        clinicalPlans: [
          "X-quang hoặc CT xoang nếu kéo dài",
          "Rửa mũi nước muối",
          "Cân nhắc kháng sinh nếu triệu chứng trên 10 ngày",
        ],
        suggestedDrugs: [
          {
            keyword: "amoxicillin",
            routeFrequency: "1 viên x 2 lần/ngày sau ăn",
            duration: "7 ngày",
            quantity: 14,
          },
        ],
      },
      {
        code: "J30",
        name: "Viêm mũi dị ứng",
        subjectiveSymptoms: [
          "Hắt hơi thành tràng, ngứa mũi",
          "Chảy nước mũi trong, nghẹt mũi",
          "Ngứa mắt, chảy nước mắt",
        ],
        objectiveFindings: [
          "Niêm mạc mũi nhợt, phù nề",
          "Polyp mũi nếu có",
          "Không sốt",
        ],
        clinicalPlans: [
          "Test dị nguyên nếu cần",
          "Tránh tác nhân gây dị ứng",
          "Rửa mũi nước muối hằng ngày",
        ],
        suggestedDrugs: [
          {
            keyword: "loratadine",
            routeFrequency: "1 viên/ngày buổi tối",
            duration: "14 ngày",
            quantity: 14,
          },
        ],
      },
      {
        code: "J20",
        name: "Viêm phế quản cấp",
        subjectiveSymptoms: [
          "Ho kéo dài, có đờm",
          "Đau ngực khi ho",
          "Sốt nhẹ, mệt mỏi",
        ],
        objectiveFindings: [
          "Phổi có ran ẩm hoặc ran phế quản",
          "Không khó thở khi nghỉ",
          "Họng sung huyết",
        ],
        clinicalPlans: [
          "X-quang ngực nếu nghi viêm phổi",
          "Công thức máu, CRP",
          "Tư vấn uống nước ấm và nghỉ ngơi",
        ],
        suggestedDrugs: [
          {
            keyword: "paracetamol",
            routeFrequency: "1 viên x 3 lần/ngày khi sốt",
            duration: "5 ngày",
            quantity: 15,
          },
        ],
      },
      {
        code: "J45",
        name: "Hen phế quản",
        subjectiveSymptoms: [
          "Khó thở từng cơn, khò khè",
          "Ho về đêm, nặng ngực",
          "Cơn hen sau tiếp xúc dị nguyên hoặc trời lạnh",
        ],
        objectiveFindings: [
          "Ran rít, ran ngáy hai phổi",
          "SpO2 có thể giảm trong cơn",
          "Nhịp thở nhanh",
        ],
        clinicalPlans: [
          "Đo chức năng hô hấp, test hồi phục",
          "X-quang ngực",
          "Tư vấn tránh dị nguyên và dùng thuốc dự phòng đúng cách",
        ],
        suggestedDrugs: [
          {
            keyword: "salbutamol",
            routeFrequency: "1 viên x 3 lần/ngày khi khó thở",
            duration: "5 ngày",
            quantity: 15,
          },
          {
            keyword: "budesonide",
            routeFrequency: "2 nhịp x 2 lần/ngày",
            duration: "30 ngày",
            quantity: 2,
          },
        ],
      },
      {
        code: "H66",
        name: "Viêm tai giữa cấp",
        subjectiveSymptoms: [
          "Đau tai, ù tai",
          "Sốt, quấy khóc ở trẻ",
          "Chảy mủ tai",
        ],
        objectiveFindings: [
          "Màng nhĩ sung huyết, phồng",
          "Dịch mủ ống tai ngoài nếu thủng",
          "Hạch sau tai",
        ],
        clinicalPlans: [
          "Soi tai, đánh giá màng nhĩ",
          "Công thức máu nếu sốt cao",
          "Tư vấn giữ tai khô, tái khám sau 48-72 giờ",
        ],
        suggestedDrugs: [
          {
            keyword: "amoxicillin",
            routeFrequency: "1 viên x 3 lần/ngày",
            duration: "7 ngày",
            quantity: 21,
          },
        ],
      },
    ],
  },
  {
    id: "DERM",
    name: "Da liễu",
    description: "Viêm da cơ địa, tiếp xúc, mày đay, zona, vảy nến, nấm, trứng cá.",
    diseases: [
      {
        code: "L20",
        name: "Viêm da cơ địa / Tổ đỉa",
        subjectiveSymptoms: [
          "Ngứa nhiều, tái phát từng đợt",
          "Da khô, bong vảy",
          "Nổi mụn nước ở khuỷu hoặc khoeo",
        ],
        objectiveFindings: [
          "Mảng hồng ban, lichen hóa",
          "Nứt da, rỉ dịch",
          "Dấu hiệu nhiễm khuẩn thứ phát",
        ],
        clinicalPlans: [
          "Đánh giá mức độ SCORAD",
          "Tư vấn dưỡng ẩm không hương liệu",
          "Tránh xà phòng mạnh và nước nóng",
        ],
        suggestedDrugs: [
          {
            keyword: "hydrocortisone",
            routeFrequency: "Bôi 2 lần/ngày",
            duration: "14 ngày",
            quantity: 1,
          },
          {
            keyword: "cetirizine",
            routeFrequency: "1 viên/ngày buổi tối",
            duration: "14 ngày",
            quantity: 14,
          },
        ],
      },
      {
        code: "L23",
        name: "Viêm da tiếp xúc dị ứng",
        subjectiveSymptoms: [
          "Ngứa, rát sau tiếp xúc chất lạ",
          "Đỏ da, mụn nước tại vùng tiếp xúc",
          "Khởi phát nhanh trong 24-48 giờ",
        ],
        objectiveFindings: [
          "Hồng ban ranh giới rõ theo vùng tiếp xúc",
          "Mụn nước, rỉ dịch",
          "Không sốt",
        ],
        clinicalPlans: [
          "Xác định và loại bỏ tác nhân",
          "Chườm mát, dưỡng ẩm",
          "Cân nhắc corticosteroid tại chỗ",
        ],
        suggestedDrugs: [
          {
            keyword: "hydrocortisone",
            routeFrequency: "Bôi 2 lần/ngày",
            duration: "10 ngày",
            quantity: 1,
          },
        ],
      },
      {
        code: "L50.0",
        name: "Mày đay cấp tính",
        subjectiveSymptoms: [
          "Nổi mề đay ngứa từng đợt",
          "Sưng môi hoặc mí mắt",
          "Khó thở, khàn tiếng (cảnh báo phù mạch)",
        ],
        objectiveFindings: [
          "Sẩn phù di chuyển, hồng ban",
          "Dermographism dương tính",
          "Tổn thương không để lại sẹo",
        ],
        clinicalPlans: [
          "Tìm và loại bỏ dị nguyên",
          "Cảnh báo dấu hiệu phù mạch hoặc khó thở",
          "Tư vấn tránh thuốc và thức ăn nghi ngờ",
        ],
        suggestedDrugs: [
          {
            keyword: "loratadine",
            routeFrequency: "1 viên/ngày",
            duration: "7 ngày",
            quantity: 7,
          },
        ],
      },
      {
        code: "B02.9",
        name: "Zona thần kinh",
        subjectiveSymptoms: [
          "Đau rát theo dải da một bên",
          "Nổi mụn nước thành chùm",
          "Đau trước khi nổi ban",
        ],
        objectiveFindings: [
          "Mụn nước theo dermatome, một bên",
          "Da nền hồng ban",
          "Không vượt đường giữa",
        ],
        clinicalPlans: [
          "Khởi trị kháng virus trong 72 giờ",
          "Giảm đau, chăm sóc vùng da",
          "Tư vấn biến chứng đau sau zona",
        ],
        suggestedDrugs: [
          {
            keyword: "acyclovir",
            routeFrequency: "1 viên x 5 lần/ngày",
            duration: "7 ngày",
            quantity: 35,
          },
          {
            keyword: "paracetamol",
            routeFrequency: "1 viên x 3 lần/ngày khi đau",
            duration: "7 ngày",
            quantity: 21,
          },
        ],
      },
      {
        code: "L40.0",
        name: "Vảy nến thông thường",
        subjectiveSymptoms: [
          "Mảng đỏ bong vảy trắng",
          "Ngứa nhẹ",
          "Tổn thương khuỷu, gối, da đầu",
        ],
        objectiveFindings: [
          "Mảng vảy nến ranh giới rõ",
          "Dấu hiệu Auspitz",
          "Tổn thương móng",
        ],
        clinicalPlans: [
          "Đánh giá PASI",
          "Dưỡng ẩm, tránh chấn thương da",
          "Cân nhắc thuốc tại chỗ hoặc ánh sáng trị liệu",
        ],
        suggestedDrugs: [
          {
            keyword: "calcipotriol",
            routeFrequency: "Bôi 2 lần/ngày",
            duration: "30 ngày",
            quantity: 1,
          },
        ],
      },
      {
        code: "B35",
        name: "Nấm da / Hắc lào",
        subjectiveSymptoms: [
          "Ngứa, vòng đỏ lan rộng",
          "Bong vảy ở rìa tổn thương",
          "Tổn thương ở bẹn hoặc thân mình",
        ],
        objectiveFindings: [
          "Mảng hình vòng, rìa gồ cao",
          "Bong vảy trung tâm",
          "Soi nấm dương tính",
        ],
        clinicalPlans: [
          "Soi tươi/KOH tìm nấm",
          "Giữ khô thoáng vùng da",
          "Điều trị đồng thời vật nuôi và quần áo",
        ],
        suggestedDrugs: [
          {
            keyword: "clotrimazole",
            routeFrequency: "Bôi 2 lần/ngày",
            duration: "21 ngày",
            quantity: 1,
          },
        ],
      },
      {
        code: "L70.0",
        name: "Trứng cá thông thường",
        subjectiveSymptoms: [
          "Mụn đầu đen, đầu trắng ở mặt",
          "Mụn viêm, đau",
          "Da nhờn",
        ],
        objectiveFindings: [
          "Nhân mụn hở và kín",
          "Sẩn, mụn mủ vùng trán và má",
          "Không có nang lớn",
        ],
        clinicalPlans: [
          "Đánh giá mức độ nặng",
          "Rửa mặt dịu nhẹ 2 lần/ngày",
          "Tư vấn tránh nặn mụn",
        ],
        suggestedDrugs: [
          {
            keyword: "benzoyl peroxide",
            routeFrequency: "Bôi 1 lần/ngày buổi tối",
            duration: "30 ngày",
            quantity: 1,
          },
          {
            keyword: "adapalene",
            routeFrequency: "Bôi 1 lần/ngày buổi tối",
            duration: "30 ngày",
            quantity: 1,
          },
        ],
      },
    ],
  },
  {
    id: "DIGEST",
    name: "Tiêu hóa & Tiết niệu",
    description: "Ruột kích thích, nhiễm khuẩn tiết niệu, sỏi túi mật.",
    diseases: [
      {
        code: "K58",
        name: "Hội chứng ruột kích thích",
        subjectiveSymptoms: [
          "Đau bụng tái diễn, giảm sau đi cầu",
          "Thay đổi thói quen đại tiện",
          "Đầy hơi, chướng bụng",
        ],
        objectiveFindings: [
          "Bụng mềm, ấn đau nhẹ",
          "Không có dấu hiệu cảnh báo",
          "Không thiếu máu",
        ],
        clinicalPlans: [
          "Loại trừ bệnh lý thực thể",
          "Tư vấn chế độ ăn ít FODMAP",
          "Quản lý căng thẳng và vận động đều",
        ],
        suggestedDrugs: [
          {
            keyword: "mebeverine",
            routeFrequency: "1 viên x 3 lần/ngày trước ăn",
            duration: "14 ngày",
            quantity: 42,
          },
        ],
      },
      {
        code: "N39.0",
        name: "Nhiễm khuẩn đường tiết niệu",
        subjectiveSymptoms: [
          "Tiểu buốt, tiểu rắt",
          "Tiểu nhiều lần, nước tiểu đục",
          "Đau hông lưng, sốt",
        ],
        objectiveFindings: [
          "Ấn đau hố thắt lưng",
          "Nước tiểu đục, có mùi",
          "Sốt nếu viêm đài bể thận",
        ],
        clinicalPlans: [
          "Tổng phân tích nước tiểu, cấy nước tiểu",
          "Siêu âm hệ tiết niệu nếu tái phát",
          "Tư vấn uống đủ nước và vệ sinh đúng cách",
        ],
        suggestedDrugs: [
          {
            keyword: "ciprofloxacin",
            routeFrequency: "1 viên x 2 lần/ngày",
            duration: "7 ngày",
            quantity: 14,
          },
        ],
      },
      {
        code: "K80",
        name: "Sỏi túi mật",
        subjectiveSymptoms: [
          "Đau hạ sườn phải sau ăn mỡ",
          "Buồn nôn, đầy bụng",
          "Đau lan vai phải",
        ],
        objectiveFindings: [
          "Ấn đau hạ sườn phải",
          "Dấu hiệu Murphy dương tính",
          "Không sốt hoặc sốt nhẹ",
        ],
        clinicalPlans: [
          "Siêu âm bụng, công thức máu, men gan",
          "Đánh giá biến chứng viêm túi mật",
          "Tư vấn chế độ ăn ít mỡ, hẹn phẫu thuật nếu có chỉ định",
        ],
        suggestedDrugs: [
          {
            keyword: "paracetamol",
            routeFrequency: "1 viên x 3 lần/ngày khi đau",
            duration: "5 ngày",
            quantity: 15,
          },
        ],
      },
    ],
  },
];
