import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  X,
  FileUp,
  FileText,
  Loader2,
  FolderOpen,
  UploadCloud,
  Terminal,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  getRawPipelineFilesApi,
  uploadRawDocApi,
  gatewayErrorDetail,
} from "../../../../services/aiGatewayAdminApi";
import type {
  ParserType,
  PipelineRunResult,
  RawPipelineFile,
  TargetAudienceOverride,
} from "../../../../services/aiGatewayAdminApi";
import type { ReindexOptions } from "../../hooks/useKnowledgeBase";

interface AddKnowledgeDocModalProps {
  onClose: () => void;
  /**
   * Run the real ingestion pipeline for one `raw_docs` file. The parent's
   * knowledge-base hook owns the call (and its loading flag), so this modal
   * only collects the parameters and reports the outcome. The full result is
   * kept on screen so its `logs` can feed the terminal window.
   */
  onRunIngest: (
    filename: string,
    parserType: ParserType,
    options?: ReindexOptions,
  ) => Promise<PipelineRunResult>;
}

const PARSER_OPTIONS: {
  value: ParserType;
  title: string;
  detail: string;
}[] = [
  {
    value: "docling",
    title: "Docling (Local CPU)",
    detail: "Phân tích .docx/.pdf tại chỗ - Khuyến nghị",
  },
  {
    value: "llama",
    title: "LlamaParse (Cloud Vision)",
    detail: "Đám mây - tốt cho scan / bố cục phức tạp",
  },
];

const AUDIENCE_OPTIONS: { value: TargetAudienceOverride; label: string }[] = [
  { value: "auto", label: "Tự động phân loại" },
  { value: "tiep_don", label: "Tiếp nhận" },
  { value: "bac_si", label: "Bác sĩ" },
];

export default function AddKnowledgeDocModal({
  onClose,
  onRunIngest,
}: AddKnowledgeDocModalProps) {
  const [rawFiles, setRawFiles] = useState<RawPipelineFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [filesError, setFilesError] = useState("");
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [manualFilename, setManualFilename] = useState("");
  const [parserType, setParserType] = useState<ParserType>("docling");
  const [audience, setAudience] = useState<TargetAudienceOverride>("auto");
  const [forceReparse, setForceReparse] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  /** Finished pipeline run whose logs/badges the terminal is showing. */
  const [pipelineResult, setPipelineResult] = useState<PipelineRunResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The gateway lists what actually sits in data/raw_docs/ - the modal can
  // only ingest files it can see, so this replaces the old free-text upload
  // fantasy (no file ever left the browser).
  useEffect(() => {
    const controller = new AbortController();
    getRawPipelineFilesApi()
      .then((files) => {
        if (controller.signal.aborted) return;
        setRawFiles(files);
        setFilesError("");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setFilesError(gatewayErrorDetail(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingFiles(false);
      });
    return () => controller.abort();
  }, []);

  /**
   * POST one local file into the gateway's data/raw_docs/, then re-list so
   * the fresh upload lands in the selection list already highlighted.
   * Only ever called from event handlers, never from an effect.
   */
  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const uploaded = await uploadRawDocApi(file);
      const storedName = uploaded.filename || file.name;
      toast.success(
        uploaded.message ??
          `Đã tải lên "${storedName}" vào data/raw_docs/.`,
      );
      try {
        const files = await getRawPipelineFilesApi();
        setRawFiles(files);
        setFilesError("");
      } catch (cause: unknown) {
        setFilesError(gatewayErrorDetail(cause));
      }
      setSelectedFile(storedName);
      setManualFilename("");
      setPipelineResult(null);
    } catch (cause: unknown) {
      toast.error(gatewayErrorDetail(cause), { duration: 6000 });
    } finally {
      setIsUploading(false);
    }
  }, []);

  // The effective filename: an explicit manual entry wins over the picked row,
  // so an admin can still ingest a file dropped in after the list loaded.
  const filename = manualFilename.trim() || selectedFile;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!filename) {
      toast.error("Vui lòng chọn một tệp từ data/raw_docs/ hoặc nhập tên tệp.");
      return;
    }

    setIsSubmitting(true);
    setPipelineResult(null);
    try {
      const result = await onRunIngest(filename, parserType, {
        forceReparse,
        targetAudienceOverride: audience,
      });
      // Keep the modal open: the terminal window below shows the returned
      // logs and the chunk/entity/rows summary instead of a bare toast.
      setPipelineResult(result);
      toast.success(
        `Đã nhúng "${result.specialty || filename}" thành ${result.chunks_created} chunks vào pgvector.`,
        { duration: 5000 },
      );
    } catch (cause) {
      toast.error(gatewayErrorDetail(cause), { duration: 6000 });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Tải lên tài liệu tri thức"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200/80 bg-white shadow-elevated">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileUp size={18} className="text-slate-700" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">
              Chỉ mục Tài liệu RAG
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
        >
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Tải tệp lên data/raw_docs/
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleUpload(file);
              }}
              className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-4 text-center transition-colors ${
                isDragging
                  ? "border-slate-700 bg-slate-50"
                  : "border-slate-300 bg-white"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.md"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 transition-colors hover:text-slate-900 disabled:opacity-60"
              >
                {isUploading ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <UploadCloud size={15} aria-hidden="true" />
                )}
                {isUploading
                  ? "Đang tải lên gateway..."
                  : "Chọn tệp .pdf / .docx hoặc kéo thả vào đây"}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Tệp trong data/raw_docs/ *
            </label>
            {isLoadingFiles ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Đang tải danh sách tệp từ AI Gateway...
              </div>
            ) : rawFiles.length > 0 ? (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
                {rawFiles.map((file) => {
                  const active = selectedFile === file.filename && !manualFilename.trim();
                  return (
                    <button
                      key={file.filename}
                      type="button"
                      onClick={() => {
                        setSelectedFile(file.filename);
                        setManualFilename("");
                      }}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
                        active
                          ? "bg-slate-800 text-white"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <FileText size={14} className="shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                        {file.filename}
                      </span>
                      <span
                        className={`shrink-0 text-[10px] ${active ? "text-slate-300" : "text-slate-400"}`}
                      >
                        {file.size_kb.toFixed(1)} KB
                        {file.has_parsed_md ? " · đã parse" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                <FolderOpen size={14} aria-hidden="true" />
                {filesError
                  ? `Không tải được danh sách tệp: ${filesError}`
                  : "Thư mục data/raw_docs/ đang trống - hãy sao chép tài liệu vào đó trước."}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Hoặc nhập tên tệp thủ công
            </label>
            <input
              type="text"
              value={manualFilename}
              onChange={(e) => setManualFilename(e.target.value)}
              placeholder="VD: Trieu chung chan doan som.docx"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Bộ phân tích (Parser) *
            </label>
            <div className="space-y-2">
              {PARSER_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                    parserType === opt.value
                      ? "border-slate-800 bg-slate-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="parser-type"
                    value={opt.value}
                    checked={parserType === opt.value}
                    onChange={() => setParserType(opt.value)}
                    className="mt-0.5 accent-slate-800"
                  />
                  <span>
                    <span className="block text-xs font-bold text-slate-800">
                      {opt.title}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {opt.detail}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Phân loại độc giả
              </label>
              <select
                value={audience}
                onChange={(e) =>
                  setAudience(e.target.value as TargetAudienceOverride)
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"
              >
                {AUDIENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="mt-5 flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={forceReparse}
                onChange={(e) => setForceReparse(e.target.checked)}
                className="accent-slate-800"
              />
              Phân tích lại dù đã có bản parse
            </label>
          </div>

          {(isSubmitting || pipelineResult) && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Terminal size={13} aria-hidden="true" />
                Nhật ký Pipeline
              </p>
              <div
                className="h-56 space-y-1 overflow-y-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-200"
                role="log"
                aria-live="polite"
              >
                {isSubmitting && !pipelineResult ? (
                  <p className="flex items-center gap-2 text-slate-300">
                    <Loader2 size={12} className="animate-spin shrink-0" aria-hidden="true" />
                    Đang chạy pipeline cho "{filename}" - phân tích, nhúng và
                    ghi vào pgvector...
                  </p>
                ) : (
                  pipelineResult?.logs.map((line, index) => (
                    <p key={index} className="flex items-start gap-2">
                      <span
                        className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                          /\b(error|fail|exception|traceback)\b/i.test(line)
                            ? "bg-red-400"
                            : /\b(warn|warning)\b/i.test(line)
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={`min-w-0 break-words ${
                          /\b(error|fail|exception|traceback)\b/i.test(line)
                            ? "text-red-400"
                            : /\b(warn|warning)\b/i.test(line)
                              ? "text-amber-300"
                              : "text-slate-200"
                        }`}
                      >
                        {line}
                      </span>
                    </p>
                  ))
                )}
              </div>
              {pipelineResult && !isSubmitting && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                    <CheckCircle2 size={11} className="text-emerald-600" aria-hidden="true" />
                    {pipelineResult.chunks_created} chunks tạo mới
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                    {pipelineResult.entities_found} entities trích xuất
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                    {pipelineResult.rows_deleted} dòng cũ đã xóa
                  </span>
                  {!pipelineResult.success && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600">
                      <AlertTriangle size={11} aria-hidden="true" />
                      Pipeline báo lỗi
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !filename}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Đang phân tích &amp; nhúng...
                </>
              ) : (
                <>
                  <FileUp size={16} aria-hidden="true" />
                  Chạy Pipeline &amp; Chỉ mục RAG
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
