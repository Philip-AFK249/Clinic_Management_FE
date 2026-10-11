import axios from "axios";

/**
 * Typed HTTP client for the AI Gateway's administrative surface (FastAPI),
 * which serves the admin console's model configuration, the pgvector knowledge
 * store, the ingestion pipeline and the OCR audit trail.
 *
 * Talks to the gateway **directly** at `VITE_RAG_API_URL` (default
 * http://localhost:8008) rather than through the Vite dev proxy, exactly like
 * `ocrApi` / `voiceTriageApi`: CORS is open server-side, and the pipeline run
 * is a synchronous parse+embed round-trip that can take minutes - a proxy rule
 * and a short timeout would only get in its way.
 */
export const RAG_ADMIN_BASE: string = (
  import.meta.env.VITE_RAG_API_URL || "http://localhost:8008"
).replace(/\/+$/, "");

export const aiGatewayAdminApi = axios.create({
  baseURL: RAG_ADMIN_BASE,
  // Generous on purpose: `run-single` parses a .docx with Docling and embeds
  // every chunk before answering, which is minutes on a local CPU, not the
  // 6-8s the Spring services allow.
  timeout: 300_000,
});

// ---------------------------------------------------------------------------
// DTOs - mirror the gateway's Pydantic response models.
// ---------------------------------------------------------------------------

/** Runtime model selections, as `GET/POST /api/v1/admin/models` reports them. */
export interface ActiveModels {
  llm_model: string;
  stt_model: string;
  vlm_model: string;
  embedding_model: string;
}

export interface ModelOption {
  id: string;
  name: string;
}

export interface InfrastructureStatus {
  ai_gateway: string;
  pgvector: string;
  embedding_device: string;
}

export interface AdminModelsResponse {
  active_models: ActiveModels;
  available_options: {
    llm_models: ModelOption[];
    stt_models: ModelOption[];
    vlm_models: ModelOption[];
  };
  infrastructure_status: InfrastructureStatus;
}

/** One document indexed in PostgreSQL `clinic_knowledge_nodes` + pgvector. */
export interface RealKnowledgeDoc {
  id: string;
  title: string;
  specialty: string;
  target_audience: string;
  chunkCount: number;
  embeddingModel: string;
  createdAt: string;
  status: "INDEXED";
}

/** One audit row reconstructed from the gateway's `confirmed_bhyt.jsonl`. */
export interface RealOcrLog {
  id: string;
  documentType: "BHYT_CARD";
  patientName: string;
  extractedId: string;
  /** 0-100, as the audit trail records it. */
  confidenceScore: number;
  timestamp: string;
  status: "SUCCESS" | "FLAGGED_FOR_REVIEW";
}

/** A file sitting in the gateway's `data/raw_docs/`, ready to ingest. */
export interface RawPipelineFile {
  filename: string;
  size_kb: number;
  ext: string;
  /** True when a previously parsed Markdown sibling already exists. */
  has_parsed_md?: boolean;
}

export type ParserType = "docling" | "llama";
export type TargetAudienceOverride = "auto" | "tiep_don" | "bac_si";

/** What `POST /api/v1/pipeline/run-single` reports once ingestion finishes. */
export interface PipelineRunResult {
  success: boolean;
  doc_id: string;
  filename: string;
  specialty: string;
  target_audience: string;
  parser_used: string;
  markdown_path: string;
  chunks_created: number;
  entities_found: number;
  rows_deleted: number;
  reparsed: boolean;
  duration_ms: number;
  message: string;
  logs: string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * A human-readable reason for any failed gateway call.
 *
 * FastAPI answers with `{"detail": "..."}`, but schema rejections carry an
 * array of `{loc, msg, type}` objects instead, so the payload has to be probed
 * rather than cast - the same rule `ocrApi` follows.
 */
export function gatewayErrorDetail(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as unknown;
    if (payload && typeof payload === "object") {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) return detail.trim();
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as { msg?: unknown };
        if (typeof first?.msg === "string" && first.msg.trim()) return first.msg.trim();
      }
    }
    if (error.code === "ECONNABORTED") {
      return "Máy chủ AI Gateway phản hồi quá thời gian chờ.";
    }
    const status = error.response?.status;
    if (status) return `AI Gateway trả về lỗi HTTP ${status}.`;
    return "Không kết nối được AI Gateway. Vui lòng kiểm tra dịch vụ FastAPI đã khởi động.";
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "Đã xảy ra lỗi không xác định với AI Gateway.";
}

// ---------------------------------------------------------------------------
// Admin endpoints
// ---------------------------------------------------------------------------

/** Active model selections, dropdown options and infrastructure statuses. */
export async function getAdminModelsApi(): Promise<AdminModelsResponse> {
  const { data } = await aiGatewayAdminApi.get<AdminModelsResponse>("/api/v1/admin/models");
  return data;
}

/** Swap the runtime LLM/STT/VLM selections without restarting the gateway. */
export async function updateAdminModelsApi(payload: {
  llm_model: string;
  stt_model: string;
  vlm_model: string;
}): Promise<void> {
  await aiGatewayAdminApi.post("/api/v1/admin/models", payload);
}

/** Documents currently indexed in pgvector, with chunk counts and timestamps. */
export async function getKnowledgeDocsApi(): Promise<RealKnowledgeDoc[]> {
  const { data } = await aiGatewayAdminApi.get<{ documents: RealKnowledgeDoc[] }>(
    "/api/v1/admin/knowledge-docs",
  );
  return data.documents ?? [];
}

/** Purge a document's vector chunks (and its knowledge nodes) from pgvector. */
export async function deleteKnowledgeDocApi(docId: string): Promise<void> {
  await aiGatewayAdminApi.delete(
    `/api/v1/admin/knowledge-docs/${encodeURIComponent(docId)}`,
  );
}

/** Raw ingestible documents sitting in the gateway's `data/raw_docs/`. */
export async function getRawPipelineFilesApi(): Promise<RawPipelineFile[]> {
  const { data } = await aiGatewayAdminApi.get<{ raw_files: RawPipelineFile[] }>(
    "/api/v1/pipeline/files",
  );
  return data.raw_files ?? [];
}

/**
 * Parse -> chunk -> embed -> insert exactly one `raw_docs` file into pgvector.
 *
 * Synchronous on the gateway (minutes for a large .docx), which is why the
 * client timeout is deliberately long - see `aiGatewayAdminApi`.
 */
export async function runIngestPipelineApi(payload: {
  filename: string;
  parser_type: ParserType;
  force_reparse?: boolean;
  clean_doc_first?: boolean;
  target_audience_override?: TargetAudienceOverride;
}): Promise<PipelineRunResult> {
  const { data } = await aiGatewayAdminApi.post<PipelineRunResult>(
    "/api/v1/pipeline/run-single",
    {
      force_reparse: false,
      clean_doc_first: true,
      target_audience_override: "auto",
      ...payload,
    },
  );
  return data;
}

/** Real OCR audit logs, reconstructed from the gateway's `confirmed_bhyt.jsonl`. */
export async function getOcrLogsApi(): Promise<RealOcrLog[]> {
  const { data } = await aiGatewayAdminApi.get<{ logs: RealOcrLog[] }>(
    "/api/v1/admin/ocr-logs",
  );
  return data.logs ?? [];
}
