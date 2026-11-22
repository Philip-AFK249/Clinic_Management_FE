import { useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import ClinicalDecisionTree from "./ClinicalDecisionTree";
import type { IcdCode, RxLine, SoapDraft } from "../data/doctorMockData";
import type { DrugDto } from "../../../services/clinicalApi";

interface Icd10SelectorProps {
  suggestions: IcdCode[];
  accepted: IcdCode[];
  onToggle: (code: IcdCode) => void;
  onAdd: (code: IcdCode) => void;
  onRemove: (code: string) => void;
  /** Send one clinical note to the copilot; it answers with ICD-10 + prescription. */
  onSubmitAiProposal: (prompt: string) => void;
  /** True while a copilot turn is in flight (spinner on both AI affordances). */
  isSubmittingAi: boolean;
  /** Shared quick-select state: the tree writes straight into the chart. */
  soapDraft: SoapDraft;
  setSoapDraft: Dispatch<SetStateAction<SoapDraft>>;
  setIcdAccepted: Dispatch<SetStateAction<IcdCode[]>>;
  rxLines: RxLine[];
  setRxLines: Dispatch<SetStateAction<RxLine[]>>;
  /** Live formulary, shared with the prescribing table and sign-off guard. */
  drugs: DrugDto[];
  drugsError?: string | null;
}

/**
 * The "Đề xuất AI" badge is a one-click action: it sends this explicit
 * instruction with the live transcript / SOAP context instead of waiting for
 * the doctor to type into the optional follow-up box.
 */
const AI_PROPOSAL_PROMPT =
  "Đề xuất danh sách mã chẩn đoán ICD-10 chính xác và đơn thuốc phù hợp dựa trên hội thoại và ghi chú SOAP hiện tại.";

export default function Icd10Selector({
  suggestions,
  accepted,
  onToggle,
  onAdd,
  onRemove,
  onSubmitAiProposal,
  isSubmittingAi,
  soapDraft,
  setSoapDraft,
  setIcdAccepted,
  rxLines,
  setRxLines,
  drugs,
  drugsError,
}: Icd10SelectorProps) {
  /** One keyword drives both the clinical tree and the ICD-10 matches. */
  const [query, setQuery] = useState("");
  const [aiNote, setAiNote] = useState("");

  /** One copilot turn: button, Enter on the note, or the "Đề xuất AI" badge. */
  function submitProposal(text: string) {
    const prompt = text.trim();
    if (!prompt || isSubmittingAi) return;
    onSubmitAiProposal(prompt);
  }

  return (
    <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Mã Chẩn Đoán ICD-10
        </p>
        <button
          type="button"
          onClick={() => submitProposal(AI_PROPOSAL_PROMPT)}
          disabled={isSubmittingAi}
          title="Gửi hội thoại và ghi chú SOAP hiện tại để AI đề xuất ICD-10 và đơn thuốc"
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-teal-700 transition-colors hover:bg-teal-100 disabled:cursor-wait disabled:opacity-70"
        >
          {isSubmittingAi ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          Đề xuất AI
        </button>
      </div>

      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
        Mở <span className="font-semibold text-teal-700">Cấu trúc rễ cây</span>{" "}
        bên dưới để chọn nhanh chẩn đoán, triệu chứng và thuốc, hoặc dùng gợi ý
        AI.
      </p>

      {/* Clinical note sent to the copilot: the answer fills the tables below */}
      <div className="mt-2 flex items-center gap-1.5">
        <input
          type="text"
          value={aiNote}
          onChange={(event) => setAiNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitProposal(aiNote);
            }
          }}
          disabled={isSubmittingAi}
          aria-label="Ghi chú lâm sàng gửi cho AI"
          placeholder="Ghi chú lâm sàng, ví dụ: có thể viêm phế quản cấp độ nhẹ..."
          className="h-9 min-w-0 flex-1 rounded-lg border border-teal-200 bg-teal-50/40 px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => submitProposal(aiNote)}
          disabled={isSubmittingAi || !aiNote.trim()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-bold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isSubmittingAi ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isSubmittingAi ? "Đang gửi..." : "Gửi AI"}
        </button>
      </div>

      {/* Accepted ICD-10 chips, always removable in one tap */}
      {accepted.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {accepted.map((item, index) => (
            <span
              key={item.code}
              className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                index === 0
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-teal-200 bg-teal-50 text-teal-800"
              }`}
            >
              <span className="min-w-0 truncate">
                {item.code}
                {item.label ? ` · ${item.label}` : ""}
              </span>
              {index === 0 && (
                <span className="shrink-0 text-[10px] font-bold uppercase opacity-80">
                  Chính
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.code)}
                aria-label={`Xóa mã ${item.code}`}
                className={`shrink-0 ${index === 0 ? "text-white/80 hover:text-white" : "text-teal-600 hover:text-red-600"}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* The decision tree lives inside this card: one workflow, one search. */}
      <div className="mt-2.5">
        <ClinicalDecisionTree
          soapDraft={soapDraft}
          setSoapDraft={setSoapDraft}
          icdAccepted={accepted}
          setIcdAccepted={setIcdAccepted}
          rxLines={rxLines}
          setRxLines={setRxLines}
          drugs={drugs}
          drugsError={drugsError}
          query={query}
          onQueryChange={setQuery}
          onAddIcd={onAdd}
        />
      </div>

      {/* AI suggestions, appended after the tree as the copilot's answer */}
      <div className="mt-2 space-y-1.5">
        {isSubmittingAi && suggestions.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/60 px-2.5 py-2 text-xs text-teal-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Đang phân tích hội thoại và ghi chú SOAP để đề xuất ICD-10...
          </div>
        )}
        {suggestions.map((item) => {
          const isAccepted = accepted.some((a) => a.code === item.code);
          // `toDiagnoses` sends the first accepted code as `isPrimary`, so the
          // highlight has to follow the same order rather than every tick.
          const isPrimary = accepted[0]?.code === item.code;
          return (
            <button
              key={item.code}
              type="button"
              onClick={() => onToggle(item)}
              className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                isAccepted
                  ? "border-teal-600 bg-teal-50"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <span className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-slate-800">
                {item.code}
              </span>
              <span className="flex-1 truncate text-slate-700">
                {item.label}
              </span>
              <span className="hidden shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 sm:inline">
                Độ tin cậy: {item.confidence}%
              </span>
              {isPrimary && (
                <span className="shrink-0 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Chính
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
