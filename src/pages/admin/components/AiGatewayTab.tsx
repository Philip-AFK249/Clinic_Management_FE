import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  RefreshCw,
  FileText,
  Trash2,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Brain,
  Loader2,
} from "lucide-react";
import type { KnowledgeDocument, OcrAuditLog } from "../data/adminMockData";
import { CATEGORY_LABELS, DOC_TYPE_LABELS } from "../data/adminMockData";
import AddKnowledgeDocModal from "./Modals/AddKnowledgeDocModal";

interface AiGatewayTabProps {
  documents: KnowledgeDocument[];
  ocrLogs: OcrAuditLog[];
  isReindexing: boolean;
  reindexProgress: number;
  onAddDocument: (doc: KnowledgeDocument) => void;
  onDeleteDocument: (docId: string) => void;
  onTriggerReindex: () => void;
}

const CATEGORY_COLORS: Record<KnowledgeDocument["category"], string> = {
  BHYT_POLICY: "bg-blue-100 text-blue-800 border-blue-200",
  PRICING: "bg-amber-100 text-amber-800 border-amber-200",
  DOCTOR_SCHEDULE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CLINIC_GUIDE: "bg-violet-100 text-violet-800 border-violet-200",
};

const STATUS_LABELS: Record<KnowledgeDocument["status"], string> = {
  INDEXED: "Đã nhúng",
  SYNCING: "Đang đồng bộ",
  STALE: "Cần cập nhật",
};

export default function AiGatewayTab({
  documents,
  ocrLogs,
  isReindexing,
  reindexProgress,
  onAddDocument,
  onDeleteDocument,
  onTriggerReindex,
}: AiGatewayTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const completionNotified = useRef(false);

  useEffect(() => {
    if (reindexProgress >= 100 && !completionNotified.current) {
      completionNotified.current = true;
      toast.success("Đã đồng bộ vector embeddings vào pgvector thành công.", {
        duration: 4000,
      });
    }
  }, [reindexProgress]);

  function handleReindex() {
    completionNotified.current = false;
    onTriggerReindex();
    toast.info("Bắt đầu nhúng lại Vector Embeddings...", { duration: 3000 });
  }

  function handleDelete(doc: KnowledgeDocument) {
    onDeleteDocument(doc.id);
    toast.success(`Đã xóa tài liệu "${doc.title}" khỏi Knowledge Store.`);
  }

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
            onClick={handleReindex}
            disabled={isReindexing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isReindexing ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={14} aria-hidden="true" />
            )}
            {isReindexing ? "Đang nhúng lại..." : "Nhúng Lại Vector"}
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

      {isReindexing && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <Brain size={16} className="animate-pulse text-violet-500" aria-hidden="true" />
            <span className="text-xs font-semibold text-slate-700">
              Đang phân đoạn &amp; tính toán Vector Embeddings (1536 dims)...
            </span>
            <span className="ml-auto text-xs font-bold text-slate-800">
              {reindexProgress}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-clinical-600 transition-all duration-300"
              style={{ width: `${reindexProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Knowledge base (compact) */}
        <div className="rounded-xl border border-slate-200/80 bg-white shadow-card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cơ sở tri thức RAG</h3>
              <p className="text-[11px] text-slate-400">
                Tài liệu nguồn cho Trợ lý ảo (pgvector semantic search)
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
              {documents.length} tài liệu
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => (
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
                    <span
                      className={`inline-flex rounded-full border px-1.5 py-0.5 font-semibold ${CATEGORY_COLORS[doc.category]}`}
                    >
                      {CATEGORY_LABELS[doc.category]}
                    </span>
                    <span>{doc.chunkCount} chunks</span>
                    <span>{doc.embeddingModel}</span>
                    <span>Cập nhật {doc.updatedAt}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-semibold ${
                        doc.status === "INDEXED"
                          ? "bg-emerald-50 text-emerald-700"
                          : doc.status === "SYNCING"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700"
                      }`}
                    >
                      {STATUS_LABELS[doc.status]}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(doc)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="Xóa tài liệu"
                  aria-label={`Xóa tài liệu ${doc.title}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* AI Gateway config (compact) */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={18} className="text-slate-600" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">AI Gateway &amp; Logs</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                OpenAI API Key
              </label>
              <div className="relative">
                <Key
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type={showApiKey ? "text" : "password"}
                  defaultValue="sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"
                  readOnly
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 font-mono text-[11px] text-slate-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Hiện / ẩn khóa API"
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Whisper STT Endpoint
              </label>
              <input
                type="text"
                defaultValue="https://ai-gateway.clinic.local/stt"
                readOnly
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-[11px] text-slate-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                PaddleOCR Worker Host
              </label>
              <input
                type="text"
                defaultValue="http://localhost:8000/ocr"
                readOnly
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-[11px] text-slate-700 focus:outline-none"
              />
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-500">
              <p className="mb-1.5 font-semibold text-slate-700">Trạng thái hạ tầng AI</p>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  AI Gateway (Python/FastAPI) · 820ms
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  PaddleOCR Worker · 340ms
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  pgvector: PostgreSQL 16
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OCR audit logs */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Nhật ký Kiểm toán OCR &amp; Telemetry
            </h3>
            <p className="text-[11px] text-slate-400">
              Offline audit cho kết quả bóc tách giấy tờ tại Kiosk
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
            {ocrLogs.length} bản ghi
          </span>
        </div>
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
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{log.id}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {DOC_TYPE_LABELS[log.documentType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{log.patientName}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-700">
                    {log.extractedId}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold ${
                        log.confidenceScore >= 90 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {log.confidenceScore}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-500">{log.timestamp}</td>
                  <td className="px-4 py-3">
                    {log.status === "SUCCESS" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <CheckCircle2 size={10} aria-hidden="true" />
                        Khớp 100%
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
      </div>

      {showAddModal && (
        <AddKnowledgeDocModal
          onClose={() => setShowAddModal(false)}
          onAdd={onAddDocument}
        />
      )}
    </div>
  );
}