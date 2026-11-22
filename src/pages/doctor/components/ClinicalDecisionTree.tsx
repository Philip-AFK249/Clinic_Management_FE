import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  Droplets,
  GitBranch,
  HeartPulse,
  Search,
  Stethoscope,
  Wind,
  X,
} from "lucide-react";
import type { DrugDto } from "../../../services/clinicalApi";
import {
  CLINICAL_DECISION_TREE,
  type ClinicalDiseaseNode,
  type SuggestedDrug,
} from "../data/clinicalDecisionTree";
import { drugDisplayName, drugToRxLine } from "../data/rxMapper";
import {
  ICD10_FORMULARY,
  type IcdCode,
  type RxLine,
  type SoapDraft,
} from "../data/doctorMockData";

type SoapSection = "subjective" | "objective" | "plan";

interface ClinicalDecisionTreeProps {
  soapDraft: SoapDraft;
  setSoapDraft: Dispatch<SetStateAction<SoapDraft>>;
  icdAccepted: IcdCode[];
  setIcdAccepted: Dispatch<SetStateAction<IcdCode[]>>;
  rxLines: RxLine[];
  setRxLines: Dispatch<SetStateAction<RxLine[]>>;
  /** Live formulary, shared with the prescribing table and sign-off guard. */
  drugs: DrugDto[];
  drugsError?: string | null;
  /** Unified search: filters both the tree and the ICD-10 formulary below. */
  query: string;
  onQueryChange: (value: string) => void;
  onAddIcd: (code: IcdCode) => void;
}

interface FilteredLeaves {
  subjective: string[];
  objective: string[];
  plans: string[];
  drugs: SuggestedDrug[];
}

const BRANCH_ICONS: Record<string, typeof Stethoscope> = {
  CARDIO: HeartPulse,
  RESP: Wind,
  DERM: Droplets,
  DIGEST: Activity,
};

/** Diacritic-insensitive so "viem hong" also matches "viêm họng". */
function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/** A SOAP line without its leading bullet, used for stable tick detection. */
function lineText(line: string): string {
  return line.replace(/^[-•*]\s*/, "").trim();
}

function hasLine(text: string, value: string): boolean {
  return text.split(/\r?\n/).some((line) => lineText(line) === value);
}

function addLine(text: string, value: string): string {
  const base = text.trimEnd();
  return base ? `${base}\n- ${value}` : `- ${value}`;
}

function removeLine(text: string, value: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => lineText(line) !== value)
    .join("\n")
    .trimEnd();
}

function toggleLine(text: string, value: string): string {
  return hasLine(text, value) ? removeLine(text, value) : addLine(text, value);
}

/** First in-stock catalog row whose name/concentration contains the keyword. */
function findInStockDrug(drugs: DrugDto[], keyword: string): DrugDto | undefined {
  const wanted = normalizeText(keyword);
  if (!wanted) return undefined;
  return drugs.find((drug) => {
    if (drug.stockQuantity <= 0) return false;
    return normalizeText(`${drug.name} ${drug.concentration}`).includes(wanted);
  });
}

function leavesFor(
  disease: ClinicalDiseaseNode,
  query: string,
  branchMatched: boolean,
  drugs: DrugDto[],
): FilteredLeaves | null {
  const all: FilteredLeaves = {
    subjective: disease.subjectiveSymptoms,
    objective: disease.objectiveFindings,
    plans: disease.clinicalPlans,
    drugs: disease.suggestedDrugs,
  };
  if (!query || branchMatched) return all;

  const diseaseMatched =
    normalizeText(disease.code).includes(query) ||
    normalizeText(disease.name).includes(query);
  if (diseaseMatched) return all;

  const filtered: FilteredLeaves = {
    subjective: disease.subjectiveSymptoms.filter((item) =>
      normalizeText(item).includes(query),
    ),
    objective: disease.objectiveFindings.filter((item) =>
      normalizeText(item).includes(query),
    ),
    plans: disease.clinicalPlans.filter((item) =>
      normalizeText(item).includes(query),
    ),
    drugs: disease.suggestedDrugs.filter((item) => {
      if (normalizeText(`${item.keyword} ${item.routeFrequency}`).includes(query)) {
        return true;
      }
      // "amoxicillin 500mg" should still find the suggestion whose keyword is
      // only "amoxicillin": judge the real catalog row too.
      const matched = findInStockDrug(drugs, item.keyword);
      return matched
        ? normalizeText(drugDisplayName(matched)).includes(query)
        : false;
    }),
  };

  const empty =
    filtered.subjective.length === 0 &&
    filtered.objective.length === 0 &&
    filtered.plans.length === 0 &&
    filtered.drugs.length === 0;
  return empty ? null : filtered;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const index = text.toLocaleLowerCase("vi").indexOf(needle.toLocaleLowerCase("vi"));
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-amber-100 px-0.5 font-semibold text-slate-900">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

const CHIP_TONES = {
  teal: "border-teal-200 bg-teal-50 text-teal-800",
  sky: "border-sky-200 bg-sky-50 text-sky-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
} as const;

function SelectedChip({
  label,
  onRemove,
  tone = "teal",
}: {
  label: ReactNode;
  onRemove: () => void;
  tone?: keyof typeof CHIP_TONES;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CHIP_TONES[tone]}`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Bỏ chọn mục này"
        className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-black/10"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

function LeafGroup({
  label,
  section,
  items,
  soapText,
  query,
  onToggle,
}: {
  label: string;
  section: SoapSection;
  items: string[];
  soapText: string;
  query: string;
  onToggle: (section: SoapSection, text: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="py-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-0.5 space-y-0.5">
        {items.map((text) => {
          const checked = hasLine(soapText, text);
          return (
            <button
              key={`${section}-${text}`}
              type="button"
              onClick={() => onToggle(section, text)}
              aria-pressed={checked}
              className={`flex min-h-[36px] w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-[11px] leading-snug transition-colors ${
                checked
                  ? "bg-teal-50 text-teal-900"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  checked
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {checked && <Check className="h-3 w-3" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <Highlight text={text} query={query} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DrugGroup({
  suggestions,
  drugs,
  rxLines,
  query,
  onToggle,
}: {
  suggestions: SuggestedDrug[];
  drugs: DrugDto[];
  rxLines: RxLine[];
  query: string;
  onToggle: (suggestion: SuggestedDrug, drug: DrugDto) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="py-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Thuốc gợi ý từ kho (Rx)
      </p>
      <div className="mt-0.5 space-y-0.5">
        {suggestions.map((suggestion) => {
          const drug = findInStockDrug(drugs, suggestion.keyword);
          const checked = drug
            ? rxLines.some((line) => line.drugId === drug.id)
            : false;
          const unit = drug?.unit || "Viên";
          return (
            <button
              key={`${suggestion.keyword}-${suggestion.routeFrequency}-${suggestion.duration}`}
              type="button"
              disabled={!drug}
              onClick={() => {
                if (drug) onToggle(suggestion, drug);
              }}
              aria-pressed={checked}
              className={`flex min-h-[36px] w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-[11px] leading-snug transition-colors ${
                !drug
                  ? "cursor-not-allowed text-slate-400"
                  : checked
                    ? "bg-violet-50 text-violet-900"
                    : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  checked
                    ? "border-violet-600 bg-violet-600 text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {checked && <Check className="h-3 w-3" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-slate-800">
                  {drug ? (
                    <Highlight text={drugDisplayName(drug)} query={query} />
                  ) : (
                    suggestion.keyword
                  )}
                </span>
                <span className="ml-1 text-[10px] text-slate-500">
                  {suggestion.routeFrequency} · {suggestion.duration} · SL{" "}
                  {suggestion.quantity} {unit}
                </span>
                {!drug && (
                  <span className="ml-1 text-[10px] font-semibold text-red-500">
                    Chưa có trong kho
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The quick-select half of the ICD-10 card.
 *
 * Folded inside `Icd10Selector` rather than sitting in its own card, so the
 * doctor reads one workflow: search a keyword, pick the disease, tick the
 * symptoms/plan it implies and the in-stock drugs that treat it. Everything is
 * reversible from the chips above the tree, and the manual ICD/SOAP editors
 * below remain the fallback.
 */
export default function ClinicalDecisionTree({
  soapDraft,
  setSoapDraft,
  icdAccepted,
  setIcdAccepted,
  rxLines,
  setRxLines,
  drugs,
  drugsError,
  query,
  onQueryChange,
  onAddIcd,
}: ClinicalDecisionTreeProps) {
  const [open, setOpen] = useState(false);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedDiseases, setExpandedDiseases] = useState<Set<string>>(
    () => new Set(),
  );
  const normalizedQuery = normalizeText(query);
  // A search always reveals its matches; otherwise the section stays compact
  // until the doctor opens it.
  const expanded = open || normalizedQuery.length > 0;

  const icdMatches = useMemo(() => {
    if (!normalizedQuery) return [];
    return ICD10_FORMULARY.filter(
      (item) =>
        normalizeText(item.code).includes(normalizedQuery) ||
        normalizeText(item.label).includes(normalizedQuery),
    ).slice(0, 6);
  }, [normalizedQuery]);

  function toggleBranch(id: string) {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDiseaseExpansion(code: string) {
    setExpandedDiseases((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleDiagnosis(disease: ClinicalDiseaseNode) {
    const selected = icdAccepted.some((item) => item.code === disease.code);
    if (selected) {
      setIcdAccepted((prev) => prev.filter((item) => item.code !== disease.code));
      return;
    }
    setIcdAccepted((prev) => [
      ...prev,
      { code: disease.code, label: disease.name, confidence: 0 },
    ]);
    setExpandedDiseases((prev) => {
      const next = new Set(prev);
      next.add(disease.code);
      return next;
    });
  }

  function toggleLeaf(section: SoapSection, text: string) {
    setSoapDraft((prev) => ({
      ...prev,
      [section]: toggleLine(prev[section], text),
    }));
  }

  function toggleDrug(suggestion: SuggestedDrug, drug: DrugDto) {
    setRxLines((prev) => {
      if (prev.some((line) => line.drugId === drug.id)) {
        return prev.filter((line) => line.drugId !== drug.id);
      }
      return [
        ...prev,
        {
          ...drugToRxLine(drug, `RX-TREE-${drug.id}-${Date.now()}`),
          routeFrequency: suggestion.routeFrequency,
          duration: suggestion.duration,
          quantity: suggestion.quantity,
        },
      ];
    });
  }

  const selectedLeaves = useMemo(() => {
    const result: { section: SoapSection; text: string }[] = [];
    const seen = new Set<string>();
    for (const branch of CLINICAL_DECISION_TREE) {
      for (const disease of branch.diseases) {
        const groups: Array<[SoapSection, string[]]> = [
          ["subjective", disease.subjectiveSymptoms],
          ["objective", disease.objectiveFindings],
          ["plan", disease.clinicalPlans],
        ];
        for (const [section, items] of groups) {
          for (const text of items) {
            const key = `${section}|${text}`;
            if (seen.has(key)) continue;
            if (hasLine(soapDraft[section], text)) {
              seen.add(key);
              result.push({ section, text });
            }
          }
        }
      }
    }
    return result;
  }, [soapDraft]);

  const selectedCount =
    icdAccepted.length + selectedLeaves.length + rxLines.length;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/40">
      {/* Compact header toggle: the card stays neat on desktop until opened. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={expanded}
        className="flex min-h-[44px] w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <GitBranch className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">
          Cấu trúc rễ cây bệnh lý{" "}
          <span className="font-normal text-slate-500">
            (Chọn nhanh chẩn đoán, triệu chứng &amp; thuốc)
          </span>
        </span>
        {selectedCount > 0 && (
          <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
            {selectedCount} đã chọn
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Quick chips stay visible while collapsed so removal is always one tap. */}
      {selectedCount > 0 && (
        <div className="space-y-1.5 border-t border-slate-200 px-2.5 py-2">
          {(
            [
              ["subjective", "Triệu chứng (S)", "sky"],
              ["objective", "Khám thực thể (O)", "teal"],
              ["plan", "Chỉ định & xử lý (P)", "amber"],
            ] as const
          ).map(([section, label, tone]) => {
            const items = selectedLeaves.filter(
              (leaf) => leaf.section === section,
            );
            if (items.length === 0) return null;
            return (
              <div key={section} className="flex flex-wrap items-center gap-1">
                <span className="shrink-0 text-[10px] font-semibold text-slate-500">
                  {label}:
                </span>
                {items.map((leaf) => (
                  <SelectedChip
                    key={`${leaf.section}-${leaf.text}`}
                    tone={tone}
                    label={leaf.text}
                    onRemove={() => toggleLeaf(leaf.section, leaf.text)}
                  />
                ))}
              </div>
            );
          })}

          {rxLines.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="shrink-0 text-[10px] font-semibold text-slate-500">
                Thuốc:
              </span>
              {rxLines.map((line) => {
                const drug = drugs.find((item) => item.id === line.drugId);
                const name = drug ? drugDisplayName(drug) : line.medication;
                const unit = line.unit || drug?.unit || "Viên";
                return (
                  <SelectedChip
                    key={`rx-${line.id}`}
                    tone="violet"
                    label={`${name} · ${line.quantity} ${unit}`}
                    onRemove={() =>
                      setRxLines((prev) =>
                        prev.filter((item) => item.drugId !== line.drugId),
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="space-y-2 border-t border-slate-200 px-2.5 py-2.5">
          {/* Unified search: one keyword drives the tree and the ICD-10 list. */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Tìm bệnh lý, mã ICD-10, triệu chứng hoặc thuốc..."
              aria-label="Tìm trong cây quyết định lâm sàng và mã ICD-10"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* ICD-10 formulary matches from the same keyword. */}
          {normalizedQuery && (
            <div className="rounded-lg border border-slate-200 bg-white p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Mã ICD-10 phù hợp
              </p>
              {icdMatches.length === 0 ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  Không có mã ICD-10 nào khớp từ khóa này.
                </p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1">
                  {icdMatches.map((item) => {
                    const isAccepted = icdAccepted.some(
                      (accepted) => accepted.code === item.code,
                    );
                    return (
                      <button
                        key={`icd-match-${item.code}`}
                        type="button"
                        disabled={isAccepted}
                        onClick={() => onAddIcd(item)}
                        title={item.label}
                        className={`inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold transition-colors ${
                          isAccepted
                            ? "cursor-default border-teal-600 bg-teal-50 text-teal-800"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                        }`}
                      >
                        <span className="font-mono font-bold">{item.code}</span>
                        <span className="min-w-0 max-w-[12rem] truncate">
                          {item.label}
                        </span>
                        {isAccepted && (
                          <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Level 1: specialty branches, collapsed by default. */}
          <div className="space-y-1.5">
            {CLINICAL_DECISION_TREE.map((branch) => {
              const branchMatched =
                !normalizedQuery ||
                normalizeText(branch.name).includes(normalizedQuery) ||
                normalizeText(branch.description).includes(normalizedQuery);

              const visibleDiseases = branch.diseases
                .map((disease) => ({
                  disease,
                  leaves: leavesFor(disease, normalizedQuery, branchMatched, drugs),
                }))
                .filter(
                  (
                    entry,
                  ): entry is {
                    disease: ClinicalDiseaseNode;
                    leaves: FilteredLeaves;
                  } => entry.leaves !== null,
                );

              if (normalizedQuery && visibleDiseases.length === 0) return null;

              const branchExpanded = normalizedQuery
                ? true
                : expandedBranches.has(branch.id);
              const Icon = BRANCH_ICONS[branch.id] ?? Stethoscope;
              const selectedInBranch = branch.diseases.filter((disease) =>
                icdAccepted.some((item) => item.code === disease.code),
              ).length;

              return (
                <div
                  key={branch.id}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => toggleBranch(branch.id)}
                    aria-expanded={branchExpanded}
                    className="flex min-h-[40px] w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-slate-800">
                        <Highlight text={branch.name} query={query} />
                      </span>
                      <span className="block truncate text-[10px] text-slate-500">
                        {branch.diseases.length} bệnh lý
                        {selectedInBranch > 0
                          ? ` · ${selectedInBranch} đã chọn`
                          : ""}
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        branchExpanded ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {branchExpanded && (
                    <div className="ml-3 border-l-2 border-slate-200 pb-1.5 pl-2 sm:ml-4 sm:pl-3">
                      {visibleDiseases.map(({ disease, leaves }) => {
                        const isSelected = icdAccepted.some(
                          (item) => item.code === disease.code,
                        );
                        const isExpanded = normalizedQuery
                          ? true
                          : expandedDiseases.has(disease.code);

                        return (
                          <div key={disease.code} className="mt-1">
                            <div className="flex items-start gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleDiseaseExpansion(disease.code)
                                }
                                aria-label={
                                  isExpanded
                                    ? `Thu gọn ${disease.name}`
                                    : `Mở rộng ${disease.name}`
                                }
                                className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <ChevronRight
                                  className={`h-3.5 w-3.5 transition-transform ${
                                    isExpanded ? "rotate-90" : ""
                                  }`}
                                  aria-hidden="true"
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleDiagnosis(disease)}
                                aria-pressed={isSelected}
                                className={`flex min-h-[36px] min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors ${
                                  isSelected ? "bg-teal-50" : "hover:bg-slate-50"
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    isSelected
                                      ? "border-teal-600 bg-teal-600 text-white"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {isSelected && (
                                    <Check
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                    />
                                  )}
                                </span>
                                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                                  <Highlight text={disease.code} query={query} />
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-800">
                                  <Highlight text={disease.name} query={query} />
                                </span>
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="ml-4 border-l-2 border-dashed border-teal-200 pl-2 sm:ml-5">
                                <LeafGroup
                                  label="Triệu chứng cơ năng (S)"
                                  section="subjective"
                                  items={leaves.subjective}
                                  soapText={soapDraft.subjective}
                                  query={query}
                                  onToggle={toggleLeaf}
                                />
                                <LeafGroup
                                  label="Khám thực thể (O)"
                                  section="objective"
                                  items={leaves.objective}
                                  soapText={soapDraft.objective}
                                  query={query}
                                  onToggle={toggleLeaf}
                                />
                                <LeafGroup
                                  label="Chỉ định & Hướng xử lý (P)"
                                  section="plan"
                                  items={leaves.plans}
                                  soapText={soapDraft.plan}
                                  query={query}
                                  onToggle={toggleLeaf}
                                />
                                <DrugGroup
                                  suggestions={leaves.drugs}
                                  drugs={drugs}
                                  rxLines={rxLines}
                                  query={query}
                                  onToggle={toggleDrug}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {drugsError && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
              Không tải được kho thuốc: {drugsError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
