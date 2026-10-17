import { useState } from "react";
import Icd10Selector from "./Icd10Selector";
import PrescriptionDraftTable from "./PrescriptionDraftTable";
import type {
  Allergy,
  IcdCode,
  RxLine,
  SoapDraft,
} from "../data/doctorMockData";
import type { ConsultationStatus } from "../hooks/useAmbientConsultation";

interface SoapNoteEditorProps {
  status: ConsultationStatus;
  soapDraft: SoapDraft;
  setSoapDraft: React.Dispatch<React.SetStateAction<SoapDraft>>;
  icdSuggestions: IcdCode[];
  icdAccepted: IcdCode[];
  setIcdAccepted: React.Dispatch<React.SetStateAction<IcdCode[]>>;
  rxLines: RxLine[];
  setRxLines: React.Dispatch<React.SetStateAction<RxLine[]>>;
  allergies: Allergy[];
  /** One copilot turn; the answer lands as ICD-10 codes + prescription lines. */
  onSubmitAiProposal: (prompt: string) => void;
  isSubmittingAi: boolean;
}

const SOAP_FIELDS: {
  key: keyof SoapDraft;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "subjective",
    label: "S - Lý do vào viện & Bệnh sử",
    placeholder: "Phàn nàn của bệnh nhân, diễn tiến thời gian và triệu chứng...",
  },
  {
    key: "objective",
    label: "O - Khám lâm sàng & Dấu hiệu sinh tồn",
    placeholder: "Kết quả thăm khám, ghi nhận họng, phổi, sinh hiệu...",
  },
  {
    key: "assessment",
    label: "A - Chẩn đoán & Đánh giá lâm sàng",
    placeholder: "Chẩn đoán chính và lập luận lâm sàng với mã ICD-10...",
  },
  {
    key: "plan",
    label: "P - Kế hoạch điều trị & Dặn dò",
    placeholder: "Phác đồ điều trị, y lệnh chẩn đoán và tư vấn chăm sóc tại nhà...",
  },
];

export default function SoapNoteEditor({
  status,
  soapDraft,
  setSoapDraft,
  icdSuggestions,
  icdAccepted,
  setIcdAccepted,
  rxLines,
  setRxLines,
  allergies,
  onSubmitAiProposal,
  isSubmittingAi,
}: SoapNoteEditorProps) {
  const [expanded, setExpanded] = useState<keyof SoapDraft | null>(null);

  const showBanner = status === "DRAFT_READY" || status === "APPROVED";

  function toggleIcd(item: IcdCode) {
    setIcdAccepted((prev) =>
      prev.some((a) => a.code === item.code)
        ? prev.filter((a) => a.code !== item.code)
        : [...prev, item],
    );
  }

  function addIcd(item: IcdCode) {
    if (!icdAccepted.some((a) => a.code === item.code)) {
      setIcdAccepted((prev) => [...prev, item]);
    }
  }

  function removeIcd(code: string) {
    setIcdAccepted((prev) => prev.filter((a) => a.code !== code));
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-3">
      {showBanner && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-bold">[🤖 Bệnh án Nháp sinh tự động bởi Whisper + GPT-4o]</span>{" "}
          Vui lòng đối soát chuyên môn trước khi ký duyệt.
        </div>
      )}

      {/* SOAP framework */}
      <div className="grid grid-cols-2 gap-3">
        {SOAP_FIELDS.map((field) => (
          <div
            key={field.key}
            className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card"
          >
            <label
              htmlFor={`soap-${field.key}`}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              {field.label}
            </label>
            <textarea
              id={`soap-${field.key}`}
              rows={expanded === field.key ? 8 : 3}
              value={soapDraft[field.key]}
              onChange={(e) =>
                setSoapDraft((prev) => ({
                  ...prev,
                  [field.key]: e.target.value,
                }))
              }
              onFocus={() => setExpanded(field.key)}
              onBlur={() => setExpanded(null)}
              placeholder={field.placeholder}
              className="mt-1.5 w-full resize-none rounded-md border border-slate-200 bg-white p-2 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        ))}
      </div>

      {/* ICD-10 codes */}
      <Icd10Selector
        suggestions={icdSuggestions}
        accepted={icdAccepted}
        onToggle={toggleIcd}
        onAdd={addIcd}
        onRemove={removeIcd}
        onSubmitAiProposal={onSubmitAiProposal}
        isSubmittingAi={isSubmittingAi}
      />

      {/* Prescription */}
      <PrescriptionDraftTable
        rxLines={rxLines}
        setRxLines={setRxLines}
        allergies={allergies}
        onSubmitAiProposal={onSubmitAiProposal}
        isSubmittingAi={isSubmittingAi}
      />
    </div>
  );
}