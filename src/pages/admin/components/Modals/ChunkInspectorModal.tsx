import { useEffect, useState } from "react";
import { X, Loader2, ChevronDown, ChevronUp, Image as ImageIcon, Expand } from "lucide-react";
import {
  getDocumentChunksApi,
  gatewayErrorDetail,
} from "../../../../services/aiGatewayAdminApi";
import type {
  DocumentChunksResponse,
  KnowledgeChunkItem,
} from "../../../../services/aiGatewayAdminApi";

interface ChunkInspectorModalProps {
  docId: string;
  docTitle: string;
  onClose: () => void;
}

const AUDIENCE_LABELS: Record<string, string> = {
  tiep_don: "Tiếp nhận",
  bac_si: "Bác sĩ",
  ca_nhan: "Cá nhân",
};

/** Audience label the pipeline stored, falling back to the raw value. */
function audienceLabel(value?: string): string {
  if (!value) return "Không rõ";
  return AUDIENCE_LABELS[value] ?? value;
}

/**
 * Pull the two entity families out of a chunk's metadata. The gateway has
 * used both key spellings across parser generations, so either spelling
 * counts as present.
 */
function chunkEntities(chunk: KnowledgeChunkItem): {
  icd10: string[];
  medications: string[];
} {
  const meta = chunk.metadata;
  return {
    icd10: meta?.icd10_codes ?? meta?.icd_codes ?? [],
    medications: meta?.medications ?? meta?.drugs ?? [],
  };
}

/** One expandable chunk row: header badges, full text, entity tags. */
function ChunkRow({ chunk }: { chunk: KnowledgeChunkItem }) {
  const [expanded, setExpanded] = useState(false);
  const { icd10, medications } = chunkEntities(chunk);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
      >
        <span className="mt-0.5 shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
          #{chunk.chunk_index + 1}
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-1.5">
            {chunk.specialty && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-white">
                {chunk.specialty}
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {audienceLabel(chunk.target_audience)}
            </span>
            {icd10.slice(0, 3).map((code) => (
              <span
                key={code}
                className="rounded-full bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-700"
              >
                {code}
              </span>
            ))}
            {medications.slice(0, 2).map((drug) => (
              <span
                key={drug}
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
              >
                {drug}
              </span>
            ))}
          </span>
          <span className="line-clamp-1 block text-xs text-slate-500">
            {chunk.content}
          </span>
        </span>
        {expanded ? (
          <ChevronUp size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
        ) : (
          <ChevronDown size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-slate-100 px-3 py-3">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
            {chunk.content}
          </p>
          {(icd10.length > 0 || medications.length > 0) && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Đối tượng y tế trích xuất
              </p>
              <div className="flex flex-wrap gap-1.5">
                {icd10.map((code) => (
                  <span
                    key={code}
                    className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-rose-700"
                  >
                    {code}
                  </span>
                ))}
                {medications.map((drug) => (
                  <span
                    key={drug}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                  >
                    {drug}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Inspect what actually landed in pgvector for one knowledge document:
 * its extracted images (click to enlarge) and every stored chunk with
 * its specialty, audience and medical entities.
 */
export default function ChunkInspectorModal({
  docId,
  docTitle,
  onClose,
}: ChunkInspectorModalProps) {
  const [data, setData] = useState<DocumentChunksResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Mirrors AddKnowledgeDocModal's mount fetch: request first, state only in
  // the async callbacks, AbortController on unmount.
  useEffect(() => {
    const controller = new AbortController();
    getDocumentChunksApi(docId)
      .then((response) => {
        if (controller.signal.aborted) return;
        setData(response);
        setError("");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(gatewayErrorDetail(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [docId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Kiểm tra chunks của ${docTitle}`}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-slate-200/80 bg-white shadow-elevated">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">
              Kiểm tra Chunks &amp; Entities
            </h3>
            <p className="truncate text-[11px] text-slate-400">{docTitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                {data.total_chunks} chunks
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Đang tải chunks từ pgvector...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-600">
              Không tải được chunks: {error}
            </div>
          ) : !data || data.chunks.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
              Tài liệu này chưa có chunk nào trong pgvector - hãy chạy lại
              pipeline để chỉ mục.
            </div>
          ) : (
            <>
              {data.extracted_images.length > 0 && (
                <section>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Ảnh trích xuất ({data.extracted_images.length})
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {data.extracted_images.map((src, index) => (
                      <button
                        key={`${src}-${index}`}
                        type="button"
                        onClick={() => setPreviewImage(src)}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition-colors hover:border-slate-400"
                        aria-label={`Phóng to ảnh ${index + 1}`}
                      >
                        <img
                          src={src}
                          alt={`Ảnh trích xuất ${index + 1}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 hidden items-center justify-center bg-slate-900/40 text-white group-hover:flex">
                          <Expand size={16} aria-hidden="true" />
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Danh sách chunks ({data.chunks.length})
                </p>
                {data.chunks.map((chunk) => (
                  <ChunkRow key={chunk.chunk_index} chunk={chunk} />
                ))}
              </section>
            </>
          )}
        </div>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 p-6"
          role="button"
          tabIndex={0}
          onClick={() => setPreviewImage(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setPreviewImage(null);
          }}
        >
          <img
            src={previewImage}
            alt="Ảnh được phóng to"
            className="max-h-full max-w-full rounded-lg object-contain shadow-elevated"
          />
          <span className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white">
            <ImageIcon size={16} aria-hidden="true" />
          </span>
        </div>
      )}
    </div>
  );
}
