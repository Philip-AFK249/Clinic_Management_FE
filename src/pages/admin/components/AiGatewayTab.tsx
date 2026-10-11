import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  RefreshCw,
  FileText,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Save,
  CloudOff,
} from "lucide-react";
import {
  getAdminModelsApi,
  getOcrLogsApi,
  updateAdminModelsApi,
  gatewayErrorDetail,
} from "../../../services/aiGatewayAdminApi";
import type {
  AdminModelsResponse,
  ModelOption,
  ParserType,
  PipelineRunResult,
  RealKnowledgeDoc,
  RealOcrLog,
  TargetAudienceOverride,
} from "../../../services/aiGatewayAdminApi";
import { DOC_TYPE_LABELS } from "../data/adminMockData";
import AddKnowledgeDocModal from "./Modals/AddKnowledgeDocModal";

interface AiGatewayTabProps {
  documents: RealKnowledgeDoc[];
  isLoadingDocuments: boolean;
  documentsError: string;
  /** Id of the document whose DELETE is in flight, for per-row spinners. */
  deletingDocId: string | null;
  onRefreshDocuments: () => void;
  /** Throws on failure; the tab owns the toast. */
  onDeleteDocument: (docId: string) => Promise<void>;
  /** `useKnowledgeBase().reindexFile` - runs the real ingestion pipeline. */
  onRunIngest: (
    filename: string,
    parserType: ParserType,
    options?: { forceReparse?: boolean; targetAudienceOverride?: TargetAudienceOverride },
  ) => Promise<PipelineRunResult>;
}

/** Pipeline `specialty` codes -> the labels admins recognise. */
const SPECIALTY_LABELS: Record<string, string> = {
  tim_mach: "Tim mạch",
  ho_hap_di_ung: "Hô hấp & Dị ứng",
  da_lieu: "Da liễu",
  chung: "Chung",
};

const AUDIENCE_LABELS: Record<string, string> = {
  tiep_don: "Tiếp nhận",
  bac_si: "Bác sĩ",
};

/** ISO timestamp -> `dd/MM/yyyy HH:mm` as the audit tables print it. */
function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Colour a free-form infrastructure status string from the gateway.
 *
 * The backend reports words like "online" / "ok" / "CPU" rather than an enum,
 * so the tone is matched on common healthy/fault substrings and anything
 * unrecognised reads as a warning rather than a false green.
 */
function statusTone(value: string): string {
  const lowered = value.toLowerCase();
  if (/(down|error|fail|offline|refused)/.test(lowered)) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (/(ok|online|connected|ready|healthy|running)/.test(lowered)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function ModelSelect({
  label,
  name,
  options,
  value,
  onChange,
  isLoading,
}: {
  label: string;
  name: string;
  options: ModelOption[];
  value: string;
  onChange: (next: string) => void;
  isLoading: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={`model-${name}`}
        className="mb-1 block text-xs font-semibold text-slate-700"
      >
        {label}
      </label>
      <select
        id={`model-${name}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading || options.length === 0}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-800 focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      >
        {options.length === 0 && <option value={value || "—"}>{value || "—"}</option>}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name || option.id}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AiGatewayTab({
  documents,
  isLoadingDocuments,
  documentsError,
  deletingDocId,
  onRefreshDocuments,
  onDeleteDocument,
  onRunIngest,
}: AiGatewayTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  // --- Runtime model configuration ------------------------------------------
  const [modelsConfig, setModelsConfig] = useState<AdminModelsResponse | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const [selectedLlm, setSelectedLlm] = useState("");
  const [selectedStt, setSelectedStt] = useState("");
  const [selectedVlm, setSelectedVlm] = useState("");
  const [isSavingModels, setIsSavingModels] = useState(false);

  // --- OCR audit trail -------------------------------------------------------
  const [ocrLogs, setOcrLogs] = useState<RealOcrLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState("");

  /** Adopt a fresh models payload and reset the three selections to it. */
  const applyModels = useCallback((response: AdminModelsResponse) => {
    setModelsConfig(response);
    setSelectedLlm(response.active_models.llm_model);
    setSelectedStt(response.active_models.stt_model);
    setSelectedVlm(response.active_models.vlm_model);
    setModelsError("");
  }, []);

  const loadModels = useCallback(async () => {
    try {
      applyModels(await getAdminModelsApi());
    } catch (cause) {
      setModelsError(gatewayErrorDetail(cause));
    } finally {
      setIsLoadingModels(false);
    }
  }, [applyModels]);

  // Initial fetch only - `loadModels` stays for the retry button and the
  // the post-save refresh, but the mount effect follows the repo's pattern of
  // touching state inside async callbacks rather than a cascading setState.
  useEffect(() => {
    let cancelled = false;
    getAdminModelsApi()
      .then((response) => {
        if (!cancelled) applyModels(response);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setModelsError(gatewayErrorDetail(cause));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingModels(false);
      });
    getOcrLogsApi()
      .then((logs) => {
        if (cancelled) return;
        setOcrLogs(logs);
        setLogsError("");
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLogsError(gatewayErrorDetail(cause));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLogs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyModels]);

  async function handleSaveModels(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLlm || !selectedStt || !selectedVlm) {
      toast.error("Vui lòng chọn đủ cả ba model trước khi lưu.");
      return;
    }
    setIsSavingModels(true);
    try {
      await updateAdminModelsApi({
        llm_model: selectedLlm,
        stt_model: selectedStt,
        vlm_model: selectedVlm,
      });
      toast.success("Đã lưu cấu hình model runtime vào AI Gateway.", {
        duration: 4000,
      });
      await loadModels();
    } catch (cause) {
      toast.error(gatewayErrorDetail(cause), { duration: 6000 });
    } finally {
      setIsSavingModels(false);
    }
  }

  async function handleDelete(doc: RealKnowledgeDoc) {
    try {
      await onDeleteDocument(doc.id);
      toast.success(`Đã xóa tài liệu "${doc.title}" khỏi pgvector.`);
    } catch (cause) {
      toast.error(gatewayErrorDetail(cause), { duration: 6000 });
    }
  }

  const active = modelsConfig?.active_models;
  const options = modelsConfig?.available_options;
  const infra = modelsConfig?.infrastructure_status;
  const modelsDirty =
    active !== undefined &&
    (selectedLlm !== active.llm_model ||
      selectedStt !== active.stt_model ||
      selectedVlm !== active.vlm_model);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            AI Gateway, Hạ tầng &amp; Tri thức RAG
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Cấu hình LLM/OCR, cơ sở tri thức phục vụ Chatbot và nhật ký kiểm toán ở một
            không gian gọn gàng
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefreshDocuments}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
          >
            <Plus size={16} aria-hidden="true" />
            Tải Tài Liệu
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Knowledge base (real pgvector documents) */}
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cơ sở tri thức RAG</h3>
              <p className="text-[11px] text-slate-400">
                Tài liệu đã nhúng trong PostgreSQL pgvector (clinic_knowledge_nodes)
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
              {documents.length} tài liệu
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {isLoadingDocuments ? (
              <div className="flex items-center gap-2 px-5 py-8 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Đang tải tài liệu từ pgvector...
              </div>
            ) : documentsError ? (
              <div className="px-5 py-8 text-xs text-red-600">{documentsError}</div>
            ) : documents.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-500">
                Chưa có tài liệu nào được chỉ mục. Bấm "Tải Tài Liệu" để chạy pipeline
                ingestion cho một tệp trong data/raw_docs/.
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-slate-50/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <FileText size={16} className="text-slate-600" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900">{doc.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                      <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-700">
                        {SPECIALTY_LABELS[doc.specialty] ?? doc.specialty}
                      </span>
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-semibold text-slate-600">
                        {AUDIENCE_LABELS[doc.target_audience] ?? doc.target_audience}
                      </span>
                      <span>{doc.chunkCount} chunks</span>
                      <span>{doc.embeddingModel}</span>
                      <span>Tạo {formatTimestamp(doc.createdAt)}</span>
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                        Đã nhúng
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(doc)}
                    disabled={deletingDocId === doc.id}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Xóa tài liệu"
                    aria-label={`Xóa tài liệu ${doc.title}`}
                  >
                    {deletingDocId === doc.id ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Gateway model configuration */}
        <form
          onSubmit={handleSaveModels}
          className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card"
        >
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={18} className="text-slate-600" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">
              Cấu hình Model &amp; Hạ tầng
            </h3>
          </div>

          {isLoadingModels ? (
            <div className="flex items-center gap-2 py-6 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Đang tải cấu hình model từ AI Gateway...
            </div>
          ) : modelsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
              <p className="mb-1.5 font-semibold">Không tải được cấu hình model</p>
              <p>{modelsError}</p>
              <button
                type="button"
                onClick={() => {
                  setIsLoadingModels(true);
                  void loadModels();
                }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                <RefreshCw size={12} aria-hidden="true" />
                Thử lại
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <ModelSelect
                label="Clinical LLM (Triage / SOAP)"
                name="llm"
                options={options?.llm_models ?? []}
                value={selectedLlm}
                onChange={setSelectedLlm}
                isLoading={isLoadingModels}
              />
              <ModelSelect
                label="Whisper STT"
                name="stt"
                options={options?.stt_models ?? []}
                value={selectedStt}
                onChange={setSelectedStt}
                isLoading={isLoadingModels}
              />
              <ModelSelect
                label="BHYT VLM"
                name="vlm"
                options={options?.vlm_models ?? []}
                value={selectedVlm}
                onChange={setSelectedVlm}
                isLoading={isLoadingModels}
              />
              {active?.embedding_model && (
                <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  Embedding:{" "}
                  <span className="font-semibold text-slate-700">
                    {active.embedding_model}
                  </span>{" "}
                  (không đổi runtime)
                </p>
              )}

              <button
                type="submit"
                disabled={isSavingModels || !modelsDirty}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingModels ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save size={13} aria-hidden="true" />
                    Lưu cấu hình Model
                  </>
                )}
              </button>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-500">
                <p className="mb-1.5 font-semibold text-slate-700">
                  Trạng thái hạ tầng AI
                </p>
                <div className="space-y-1.5">
                  {(
                    [
                      ["AI Gateway (FastAPI)", infra?.ai_gateway ?? "—"],
                      ["PostgreSQL pgvector", infra?.pgvector ?? "—"],
                      ["Embedding engine", infra?.embedding_device ?? "—"],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <p key={label} className="flex items-center justify-between gap-2">
                      <span>{label}</span>
                      <span
                        className={`rounded-full border px-1.5 py-0.5 font-semibold ${statusTone(value)}`}
                      >
                        {value}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* OCR audit logs (real, from confirmed_bhyt.jsonl) */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Nhật ký Kiểm toán OCR &amp; Telemetry
            </h3>
            <p className="text-[11px] text-slate-400">
              Audit thật từ confirmed_bhyt.jsonl - mọi lượt quét thẻ BHYT đã xác nhận
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
            {ocrLogs.length} bản ghi
          </span>
        </div>
        {isLoadingLogs ? (
          <div className="flex items-center gap-2 px-5 py-8 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Đang tải nhật ký OCR...
          </div>
        ) : logsError ? (
          <div className="flex items-center gap-2 px-5 py-8 text-xs text-red-600">
            <CloudOff size={14} aria-hidden="true" />
            {logsError}
          </div>
        ) : ocrLogs.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500">
            Chưa có lượt quét thẻ BHYT nào được ghi nhận.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-600">Mã lượt quét</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Loại giấy tờ</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Tên bệnh nhân</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Mã số bóc tách</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Độ tin cậy</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Thời gian</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ocrLogs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {log.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {DOC_TYPE_LABELS[log.documentType] ?? log.documentType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {log.patientName}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-700">
                      {log.extractedId}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          log.confidenceScore >= 90 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {Math.round(log.confidenceScore)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      {log.status === "SUCCESS" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 size={10} aria-hidden="true" />
                          Hợp lệ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <AlertTriangle size={10} aria-hidden="true" />
                          Cần kiểm tra lại
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddKnowledgeDocModal
          onClose={() => setShowAddModal(false)}
          onRunIngest={onRunIngest}
        />
      )}
    </div>
  );
}
