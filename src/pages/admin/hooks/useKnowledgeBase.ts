import { useState, useCallback, useEffect } from "react";
import {
  deleteKnowledgeDocApi,
  getKnowledgeDocsApi,
  runIngestPipelineApi,
} from "../../../services/aiGatewayAdminApi";
import type {
  ParserType,
  PipelineRunResult,
  RealKnowledgeDoc,
  TargetAudienceOverride,
} from "../../../services/aiGatewayAdminApi";

export interface ReindexOptions {
  forceReparse?: boolean;
  targetAudienceOverride?: TargetAudienceOverride;
}

/** Renderable reason for a failed knowledge-docs fetch. */
function docsErrorOf(cause: unknown): string {
  return cause instanceof Error && cause.message.trim()
    ? cause.message
    : "Không tải được danh sách tài liệu tri thức.";
}

/**
 * The pgvector knowledge store, backed by the AI Gateway's real endpoints.
 *
 * Documents come from `GET /api/v1/admin/knowledge-docs` on mount (no mock
 * seed, no fake progress timer - the old "reindex everything" button had no
 * backend to call, so it animated a percentage instead; ingestion is now a
 * real per-file `run-single` call whose result carries the actual chunk
 * count). Failures land in `error` so the tab can render them inline instead
 * of replacing the list with fabricated data.
 */
export function useKnowledgeBase() {
  const [documents, setDocuments] = useState<RealKnowledgeDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  /** True while a `run-single` ingestion is in flight (modal-owned UI). */
  const [isReindexing, setIsReindexing] = useState(false);

  /** Adopt a fresh list from the gateway. */
  const applyDocs = useCallback((docs: RealKnowledgeDoc[]) => {
    setDocuments(docs);
    setError("");
  }, []);

  const refreshDocs = useCallback(async () => {
    try {
      applyDocs(await getKnowledgeDocsApi());
    } catch (cause) {
      setError(docsErrorOf(cause));
    } finally {
      setIsLoading(false);
    }
  }, [applyDocs]);

  // Mirrors useAdminPatients' mount pattern: the request itself runs here and
  // state is only touched inside the async callbacks, so the first paint is
  // never blocked by a cascading setState.
  useEffect(() => {
    let cancelled = false;
    getKnowledgeDocsApi()
      .then((docs) => {
        if (!cancelled) applyDocs(docs);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(docsErrorOf(cause));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyDocs]);

  /** Purge one document's vectors; the list is refreshed from the backend. */
  const deleteDoc = useCallback(
    async (docId: string): Promise<void> => {
      setDeletingDocId(docId);
      try {
        await deleteKnowledgeDocApi(docId);
        setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
        // Re-sync in the background: the gateway is the source of truth for
        // chunk counts, and another admin may have ingested in parallel.
        void refreshDocs();
      } finally {
        setDeletingDocId(null);
      }
    },
    [refreshDocs],
  );

  /**
   * Ingest exactly one `raw_docs` file through the pipeline and return what
   * the gateway reports (chunk count, specialty routing, timing). Throws on
   * failure so the calling modal can toast the reason - see
   * `gatewayErrorDetail`.
   */
  const reindexFile = useCallback(
    async (
      filename: string,
      parserType: ParserType,
      options?: ReindexOptions,
    ): Promise<PipelineRunResult> => {
      setIsReindexing(true);
      try {
        const result = await runIngestPipelineApi({
          filename,
          parser_type: parserType,
          force_reparse: options?.forceReparse ?? false,
          clean_doc_first: true,
          target_audience_override: options?.targetAudienceOverride ?? "auto",
        });
        await refreshDocs();
        return result;
      } finally {
        setIsReindexing(false);
      }
    },
    [refreshDocs],
  );

  return {
    documents,
    isLoading,
    error,
    deletingDocId,
    isReindexing,
    refreshDocs,
    deleteDoc,
    reindexFile,
  };
}
