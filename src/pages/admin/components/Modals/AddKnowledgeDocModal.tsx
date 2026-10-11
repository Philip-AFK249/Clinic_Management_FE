import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, FileUp, FileText, Loader2, FolderOpen } from "lucide-react";
import {
  getRawPipelineFilesApi,
  gatewayErrorDetail,
} from "../../../../services/aiGatewayAdminApi";
import type {
  ParserType,
  RawPipelineFile,
  TargetAudienceOverride,
} from "../../../../services/aiGatewayAdminApi";
import type { ReindexOptions } from "../../hooks/useKnowledgeBase";

interface AddKnowledgeDocModalProps {
  onClose: () => void;
  /**
   * Run the real ingestion pipeline for one `raw_docs` file. The parent's
   * knowledge-base hook owns the call (and its loading flag), so this modal
   * only collects the parameters and reports the outcome.
   */
  onRunIngest: (
    filename: string,
    parserType: ParserType,
    options?: ReindexOptions,
  ) => Promise<{ chunks_created: number; message: string; specialty: string }>;
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
    try {
      const result = await onRunIngest(filename, parserType, {
        forceReparse,
        targetAudienceOverride: audience,
      });
      toast.success(
        `Đã nhúng "${result.specialty || filename}" thành ${result.chunks_created} chunks vào pgvector.` +
          (result.message ? ` ${result.message}` : ""),
        { duration: 5000 },
      );
      onClose();
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
      <div className="w-full max-w-lg rounded-xl border border-slate-200/80 bg-white shadow-elevated">
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

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
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
