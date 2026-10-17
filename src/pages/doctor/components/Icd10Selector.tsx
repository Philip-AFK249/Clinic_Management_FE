import { useMemo, useState } from "react";
import { Loader2, Search, Sparkles, X } from "lucide-react";
import { ICD10_FORMULARY } from "../data/doctorMockData";
import type { IcdCode } from "../data/doctorMockData";

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
}

/**
 * What the "Đề xuất AI" badge sends when the note box is still empty, so the
 * badge is always a working action rather than a dead label.
 */
const FALLBACK_AI_NOTE =
  "Đề xuất mã chẩn đoán ICD-10 và đơn thuốc phù hợp với bệnh án hiện tại.";

export default function Icd10Selector({
  suggestions,
  accepted,
  onToggle,
  onAdd,
  onRemove,
  onSubmitAiProposal,
  isSubmittingAi,
}: Icd10SelectorProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [aiNote, setAiNote] = useState("");

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return ICD10_FORMULARY.filter(
      (item) =>
        item.code.toLowerCase().includes(trimmed) ||
        item.label.toLowerCase().includes(trimmed),
    ).slice(0, 6);
  }, [query]);

  /** One copilot turn: button, Enter on the note, or the "Đề xuất AI" badge. */
  function submitProposal(text: string) {
    const prompt = text.trim();
    if (!prompt || isSubmittingAi) return;
    onSubmitAiProposal(prompt);
  }

  return (
    <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Mã Chẩn Đoán ICD-10
        </p>
        <button
          type="button"
          onClick={() => submitProposal(aiNote.trim() || FALLBACK_AI_NOTE)}
          disabled={isSubmittingAi}
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

      {/* Clinical note sent to the copilot: the answer fills the two tables below */}
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

      {/* AI suggestions */}
      <div className="mt-2 space-y-1.5">
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
              <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
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

      {/* Accepted chips */}
      {accepted.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {accepted.map((item, index) => (
            <span
              key={item.code}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                index === 0
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-teal-200 bg-teal-50 text-teal-800"
              }`}
            >
              {item.code}
              {index === 0 && (
                <span className="text-[10px] font-bold uppercase opacity-80">
                  Chính
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.code)}
                aria-label={`Xóa mã ${item.code}`}
                className={index === 0 ? "text-white/80 hover:text-white" : "text-teal-600 hover:text-red-600"}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Autocomplete search */}
      <div className="relative mt-3">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          <Search className="h-3.5 w-3.5" />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Tìm kiếm mã ICD-10 hoặc tên bệnh lý..."
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
        {open && results.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-elevated">
            {results.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onAdd(item);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-teal-50"
                >
                  <span className="font-mono font-bold text-slate-800">
                    {item.code}
                  </span>
                  <span className="truncate text-slate-600">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}