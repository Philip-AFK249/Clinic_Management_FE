import { useEffect, useRef, useState } from "react";
import Icd10Selector from "./Icd10Selector";
import PrescriptionDraftTable from "./PrescriptionDraftTable";
import ClinicalDecisionTree from "./ClinicalDecisionTree";
import type {
  Allergy,
  IcdCode,
  RxLine,
  SoapDraft,
} from "../data/doctorMockData";
import type { ConsultationStatus } from "../hooks/useAmbientConsultation";

/**
 * A line to seed the Objective section with while it is still empty, tagged
 * with the ticket it came from so it is applied at most once per patient.
 */
export interface SoapObjectiveSeed {
  key: string;
  text: string;
}

/**
 * Which slice of the editor to render.
 *  - `all`: desktop split view (tree + SOAP + ICD + prescription)
 *  - `notes`: mobile "Khám & Chọn nhanh" tab (tree + SOAP)
 *  - `review`: mobile "Chẩn đoán & Đơn thuốc" tab (ICD + prescription)
 */
export type SoapEditorSection = "all" | "notes" | "review";

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
  /** In-room vitals (BS & Y tá), dropped into "O" only while it is empty. */
  objectiveSeed?: SoapObjectiveSeed | null;
  /** One copilot turn; the answer lands as ICD-10 codes + prescription lines. */
  onSubmitAiProposal: (prompt: string) => void;
  isSubmittingAi: boolean;
  section?: SoapEditorSection;
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
  objectiveSeed,
  onSubmitAiProposal,
  isSubmittingAi,
  section = "all",
}: SoapNoteEditorProps) {
  const [expanded, setExpanded] = useState<keyof SoapDraft | null>(null);
  const showNotes = section !== "review";
  const showReview = section !== "notes";

  /**
   * Seed "O" with the nurse station's readings, once per ticket and only while
   * the section is untouched. The ref keeps a section the doctor edited - or
   * deliberately cleared - from being rewritten by the next queue poll.
   */
  const seededObjectiveFor = useRef<string | null>(null);
  useEffect(() => {
    if (!objectiveSeed) return;
    if (seededObjectiveFor.current === objectiveSeed.key) return;
    if (soapDraft.objective.trim()) return;
    seededObjectiveFor.current = objectiveSeed.key;
    setSoapDraft((prev) =>
      prev.objective.trim() ? prev : { ...prev, objective: objectiveSeed.text },
    );
  }, [objectiveSeed, setSoapDraft, soapDraft.objective]);

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
    <div className="space-y-3 p-3">
      {showBanner && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-bold">[Bệnh án sinh tự động]</span>{" "}
          Vui lòng đối soát chuyên môn trước khi ký duyệt.
        </div>
      )}

      {showNotes && (
        <>
          {/* Primary workflow: drill down the decision tree, then fine-tune. */}
          <ClinicalDecisionTree
            soapDraft={soapDraft}
            setSoapDraft={setSoapDraft}
            icdAccepted={icdAccepted}
            setIcdAccepted={setIcdAccepted}
            rxLines={rxLines}
            setRxLines={setRxLines}
          />

          {/* SOAP framework - manual editing stays available below the tree. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        </>
      )}

      {showReview && (
        <>
          {section === "review" && (
            <div className="rounded-lg border border-teal-200/80 bg-teal-50/60 px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
                Chẩn đoán &amp; Đơn thuốc
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-teal-700">
                Kiểm tra mã ICD-10, số lượng và tồn kho trước khi ký duyệt.
              </p>
            </div>
          )}

          {/* ICD-10 codes - manual fallback for the tree. */}
          <Icd10Selector
            suggestions={icdSuggestions}
            accepted={icdAccepted}
            onToggle={toggleIcd}
            onAdd={addIcd}
            onRemove={removeIcd}
            onSubmitAiProposal={onSubmitAiProposal}
            isSubmittingAi={isSubmittingAi}
          />

          {/* Prescription - manual fallback for the tree's Rx branch. */}
          <PrescriptionDraftTable
            rxLines={rxLines}
            setRxLines={setRxLines}
            allergies={allergies}
            onSubmitAiProposal={onSubmitAiProposal}
            isSubmittingAi={isSubmittingAi}
          />
        </>
      )}
    </div>
  );
}