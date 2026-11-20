import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteFlaggedSymptomApi,
  gatewayErrorDetail,
  getFlaggedSymptomsApi,
  getFlaggedSymptomsExportUrl,
  trainFlaggedSymptomsRagApi,
  updateFlaggedSymptomApi,
} from "../../../services/aiGatewayAdminApi";
import type {
  FlaggedSymptomItem,
  FlaggedSymptomsResponse,
  FlaggedSymptomsStats,
} from "../../../services/aiGatewayAdminApi";

interface FlaggedSymptomsPanelProps {
  onKnowledgeBaseUpdated: () => void;
}

type FlaggedStatus = "PENDING" | "DOCTOR_CONFIRMED" | "TRAINED";
type StatusFilter = "ALL" | FlaggedStatus;

interface EditDraft {
  confirmed_icd10_code: string;
  confirmed_disease_name: string;
  medical_symptom_standard: string;
  age_group: string;
  ai_department_id: string;
  ai_priority_level: string;
  reception_action: string;
}

interface FlaggedSymptomRow extends FlaggedSymptomItem {
  /** Present on flags that were raised from a clinic queue ticket. */
  ticket_number?: string | null;
}

const EMPTY_STATS: FlaggedSymptomsStats = {
  total: 0,
  doctor_confirmed: 0,
  trained: 0,
  top_clusters: [],
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "DOCTOR_CONFIRMED", label: "Bác sĩ đã chẩn đoán" },
  { value: "PENDING", label: "Chờ bác sĩ khám" },
  { value: "TRAINED", label: "Đã nạp vào RAG" },
];

const EXPORT_OPTIONS: {
  format: "csv" | "md" | "json";
  label: string;
}[] = [
  { format: "csv", label: "Xuất CSV" },
  { format: "md", label: "Xuất Markdown (.md)" },
  { format: "json", label: "Xuất JSON" },
];

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
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

function normalizedStatus(item: FlaggedSymptomItem): FlaggedStatus {
  const status = String(item.status ?? "").toUpperCase();
  if (status === "TRAINED") return "TRAINED";
  if (status === "DOCTOR_CONFIRMED" || status === "CONFIRMED") {
    return "DOCTOR_CONFIRMED";
  }
  return "PENDING";
}

function statusLabel(status: FlaggedStatus): string {
  if (status === "TRAINED") return "Đã học vào RAG";
  if (status === "DOCTOR_CONFIRMED") return "Đã có chẩn đoán BS";
  return "Chờ khám";
}

function statusTone(status: FlaggedStatus): string {
  if (status === "TRAINED") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (status === "DOCTOR_CONFIRMED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function flagReasonLabel(reason?: string | null): string {
  const lowered = (reason ?? "").toLowerCase();
  if (/(ngoài|ngoai|chuyên khoa|chuyen khoa|specialty|department)/.test(lowered)) {
    return "Ngoài chuyên khoa";
  }
  return "Triệu chứng mới";
}

function ageGroupLabel(item: FlaggedSymptomItem): string {
  if (item.age_group_label?.trim()) return item.age_group_label.trim();
  const labels: Record<string, string> = {
    tre_em: "Trẻ em (< 16 tuổi)",
    nguoi_truong_thanh: "Người trưởng thành (16–59 tuổi)",
    nguoi_cao_tuoi: "Người cao tuổi (≥ 60 tuổi)",
    tat_ca: "Mọi lứa tuổi",
  };
  const value = item.age_group?.trim() ?? "";
  return labels[value] || value || "Chưa rõ";
}

function deriveStats(
  items: FlaggedSymptomItem[],
  stats: FlaggedSymptomsStats,
): FlaggedSymptomsStats {
  if (stats && typeof stats.total === "number") return stats;
  const clusters = new Map<string, number>();
  items.forEach((item) => {
    const key =
      item.ai_department_name ||
      item.confirmed_disease_name ||
      "Chưa phân nhóm";
    clusters.set(key, (clusters.get(key) ?? 0) + 1);
  });
  return {
    total: items.length,
    doctor_confirmed: items.filter(
      (item) => normalizedStatus(item) === "DOCTOR_CONFIRMED",
    ).length,
    trained: items.filter((item) => normalizedStatus(item) === "TRAINED").length,
    top_clusters: [...clusters.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, count]) => ({ label, count })),
  };
}

function draftFrom(item: FlaggedSymptomItem): EditDraft {
  return {
    confirmed_icd10_code: item.confirmed_icd10_code ?? "",
    confirmed_disease_name: item.confirmed_disease_name ?? "",
    medical_symptom_standard: item.medical_symptom_standard ?? "",
    age_group: item.age_group ?? "",
    ai_department_id:
      item.ai_department_id === null || item.ai_department_id === undefined
        ? ""
        : String(item.ai_department_id),
    ai_priority_level: item.ai_priority_level ?? "",
    reception_action: item.reception_action ?? "",
  };
}

export default function FlaggedSymptomsPanel({
  onKnowledgeBaseUpdated,
}: FlaggedSymptomsPanelProps) {
  const [data, setData] = useState<FlaggedSymptomsResponse>({
    items: [],
    stats: EMPTY_STATS,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<FlaggedSymptomItem | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getFlaggedSymptomsApi();
      setData({
        items: response.items ?? [],
        stats: response.stats ?? EMPTY_STATS,
      });
      setError("");
    } catch (cause) {
      setError(gatewayErrorDetail(cause));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getFlaggedSymptomsApi()
      .then((response) => {
        if (cancelled) return;
        setData({
          items: response.items ?? [],
          stats: response.stats ?? EMPTY_STATS,
        });
        setError("");
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(gatewayErrorDetail(cause));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = deriveStats(data.items, data.stats);
  const filteredItems = data.items.filter(
    (item) =>
      statusFilter === "ALL" || normalizedStatus(item) === statusFilter,
  );
  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.has(item.flag_id));

  function toggleSelection(flagId: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(flagId)) next.delete(flagId);
      else next.add(flagId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      filteredItems.forEach((item) => {
        if (allVisibleSelected) next.delete(item.flag_id);
        else next.add(item.flag_id);
      });
      return next;
    });
  }

  async function handleTrain(idsOverride?: string[]) {
    const ids =
      idsOverride ??
      (selectedIds.size > 0
        ? [...selectedIds]
        : data.items
            .filter((item) => normalizedStatus(item) === "DOCTOR_CONFIRMED")
            .map((item) => item.flag_id));
    if (ids.length === 0) {
      toast.error("Chưa có ca nào được bác sĩ chốt chẩn đoán để nạp vào RAG.");
      return;
    }
    setIsTraining(true);
    try {
      const result = await trainFlaggedSymptomsRagApi(ids);
      if (!result.success) {
        throw new Error(result.message || "Gateway báo lỗi khi nạp RAG.");
      }
      toast.success(
        `${result.message || "Đã nạp dữ liệu ngoài thu thập vào RAG."} (${result.trained_count} ca, ${result.chunks_created} chunks)`,
        { duration: 5000 },
      );
      setSelectedIds(new Set());
      await load();
      onKnowledgeBaseUpdated();
    } catch (cause) {
      toast.error(gatewayErrorDetail(cause), { duration: 6000 });
    } finally {
      setIsTraining(false);
    }
  }

  async function handleDelete(item: FlaggedSymptomItem) {
    if (
      !window.confirm(
        `Xóa ca ngoài thu thập "${item.flag_id}"? Hành động này không thể hoàn tác.`,
      )
    ) {
      return;
    }
    setDeletingId(item.flag_id);
    try {
      await deleteFlaggedSymptomApi(item.flag_id);
      toast.success("Đã xóa ca ngoài thu thập.");
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(item.flag_id);
        return next;
      });
      await load();
    } catch (cause) {
      toast.error(gatewayErrorDetail(cause), { duration: 6000 });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem || !draft) return;
    setIsSaving(true);
    try {
      const departmentId =
        draft.ai_department_id.trim() === ""
          ? null
          : Number(draft.ai_department_id);
      if (departmentId !== null && Number.isNaN(departmentId)) {
        throw new Error("Mã chuyên khoa phải là số.");
      }
      await updateFlaggedSymptomApi(editingItem.flag_id, {
        ...draft,
        ai_department_id: departmentId,
      });
      toast.success("Đã chuẩn hóa dữ liệu ca ngoài thu thập.");
      setEditingItem(null);
      setDraft(null);
      await load();
    } catch (cause) {
      toast.error(gatewayErrorDetail(cause), { duration: 6000 });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white shadow-card">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles size={17} className="text-violet-600" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">
              Dữ liệu ngoài thu thập (Active Learning)
            </h3>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
              Học tăng cường RAG
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-500">
            Lưu trữ các mô tả triệu chứng thực tế của bệnh nhân nằm ngoài dữ liệu ban đầu, đối chiếu chẩn đoán của bác sĩ để xuất dữ liệu hoặc định dạng lại và nạp vào RAG.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
          Làm mới
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Tổng ca ngoài dữ liệu", value: String(stats.total), tone: "text-slate-900" },
          { label: "Bác sĩ đã chốt chẩn đoán", value: String(stats.doctor_confirmed), tone: "text-emerald-700" },
          { label: "Đã nạp vào RAG", value: String(stats.trained), tone: "text-violet-700" },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {card.label}
            </p>
            <p className={`mt-1 text-xl font-bold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Nhóm bệnh / chuyên khoa phát sinh nhiều nhất
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(stats.top_clusters ?? []).length > 0 ? (
              stats.top_clusters.map((cluster) => (
                <span
                  key={cluster.label}
                  className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700"
                >
                  {cluster.label} · {cluster.count}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-slate-400">Chưa có dữ liệu</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                statusFilter === filter.value
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {EXPORT_OPTIONS.map((option) => (
            <a
              key={option.format}
              href={getFlaggedSymptomsExportUrl(option.format)}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Download size={12} aria-hidden="true" />
              {option.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => void handleTrain()}
            disabled={isTraining}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isTraining ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles size={13} aria-hidden="true" />
            )}
            Định dạng lại &amp; Nạp vào RAG
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={filteredItems.length === 0}
                  aria-label="Chọn tất cả ca đang hiển thị"
                  className="accent-violet-700"
                />
              </th>
              <th className="w-[16%] px-3 py-2.5">Mã cờ &amp; Phiếu / Thời gian</th>
              <th className="w-[27%] px-3 py-2.5">Triệu chứng bệnh nhân mô tả</th>
              <th className="w-[25%] px-3 py-2.5">
                Dự đoán ICD-10 (Kiến thức AI)
              </th>
              <th className="w-[14%] px-3 py-2.5">Nhóm tuổi</th>
              <th className="sticky right-0 z-10 w-[168px] border-l border-slate-100 bg-slate-50 px-3 py-2.5 shadow-[-4px_0_10px_-8px_rgba(15,23,42,0.25)]">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-xs text-slate-500">
                  <Loader2 size={14} className="mr-2 inline animate-spin" aria-hidden="true" />
                  Đang tải dữ liệu ngoài thu thập từ AI Gateway...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-xs text-slate-500">
                  Không có ca nào khớp bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const row = item as FlaggedSymptomRow;
                const status = normalizedStatus(row);
                const description =
                  row.transcription || row.patient_description || "—";
                const predictedIcd =
                  row.ai_icd10_code || row.ai_suggested_icd10;
                const confirmed =
                  row.confirmed_icd10_code || row.confirmed_disease_name;
                return (
                  <tr
                    key={row.flag_id}
                    className="group align-top hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.flag_id)}
                        onChange={() => toggleSelection(item.flag_id)}
                        aria-label={`Chọn ca ${item.flag_id}`}
                        className="accent-violet-700"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-mono text-[11px] font-bold text-slate-800">
                        {row.flag_id}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {formatTimestamp(row.created_at)}
                      </p>
                      {row.ticket_number?.trim() && (
                        <span
                          className="mt-1.5 inline-flex max-w-full items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700"
                          title={`Phiếu khám liên kết: ${row.ticket_number}`}
                        >
                          Phiếu {row.ticket_number.trim()}
                        </span>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {flagReasonLabel(row.flag_reason)}
                        </span>
                        <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${statusTone(status)}`}>
                          {statusLabel(status)}
                        </span>
                      </div>
                      {row.flag_reason && (
                        <p className="mt-1 max-w-[180px] truncate text-[10px] text-slate-400" title={row.flag_reason}>
                          {row.flag_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <p className="max-w-[380px] whitespace-pre-wrap leading-relaxed text-slate-700" title={description}>
                        {description}
                      </p>
                      {item.medical_symptom_standard && (
                        <div className="mt-2 max-w-[380px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Đã chuẩn hóa
                          </p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                            {item.medical_symptom_standard}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {predictedIcd && (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-700">
                            {predictedIcd}
                          </span>
                        )}
                        <span className="font-semibold text-slate-800">
                          {item.ai_disease_guess ||
                            item.ai_suggested_disease ||
                            "Chưa có dự đoán"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Chuyên khoa gần nhất:{" "}
                        {item.ai_department_name ||
                          (item.ai_department_id !== null
                            ? `Khoa #${item.ai_department_id}`
                            : "Chưa xác định")}
                      </p>
                      {item.similarity_score !== null &&
                        item.similarity_score !== undefined && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Độ tương đồng: {(item.similarity_score * 100).toFixed(1)}%
                          </p>
                        )}
                      {confirmed && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            Chẩn đoán BS
                          </span>
                          {item.confirmed_icd10_code && (
                            <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                              {item.confirmed_icd10_code}
                            </span>
                          )}
                          {item.confirmed_disease_name && (
                            <span
                              className="max-w-[160px] truncate text-[10px] font-semibold text-emerald-800"
                              title={item.confirmed_disease_name}
                            >
                              {item.confirmed_disease_name}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {ageGroupLabel(item)}
                      </span>
                    </td>
                    <td className="sticky right-0 z-10 border-l border-slate-100 bg-white px-3 py-3 shadow-[-4px_0_10px_-8px_rgba(15,23,42,0.25)] group-hover:bg-slate-50">
                      <div className="flex w-full flex-col items-start gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(row);
                            setDraft(draftFrom(row));
                          }}
                          className="inline-flex whitespace-nowrap items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900"
                        >
                          <Pencil size={11} aria-hidden="true" />
                          Sửa / Chuẩn hóa
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleTrain([row.flag_id])}
                          disabled={isTraining}
                          className="inline-flex whitespace-nowrap items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900 disabled:opacity-50"
                        >
                          <Sparkles size={11} aria-hidden="true" />
                          Nạp RAG ngay
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          disabled={deletingId === row.flag_id}
                          className="inline-flex whitespace-nowrap items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {deletingId === row.flag_id ? (
                            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 size={11} aria-hidden="true" />
                          )}
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editingItem && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Chuẩn hóa ca ngoài thu thập">
          <form
            onSubmit={(event) => void handleSaveEdit(event)}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-elevated"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Sửa / Chuẩn hóa ca ngoài thu thập
                </h4>
                <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                  {editingItem.flag_id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setDraft(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">
                ICD-10 đã chốt
                <input
                  value={draft.confirmed_icd10_code}
                  onChange={(e) => setDraft({ ...draft, confirmed_icd10_code: e.target.value })}
                  placeholder="VD: J30"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-normal text-slate-800 focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Tên bệnh đã chốt
                <input
                  value={draft.confirmed_disease_name}
                  onChange={(e) => setDraft({ ...draft, confirmed_disease_name: e.target.value })}
                  placeholder="VD: Viêm mũi dị ứng"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-normal text-slate-800 focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Triệu chứng y khoa chuẩn hóa
                <textarea
                  value={draft.medical_symptom_standard}
                  onChange={(e) => setDraft({ ...draft, medical_symptom_standard: e.target.value })}
                  rows={4}
                  placeholder="Mô tả lại bằng thuật ngữ y khoa trước khi nạp RAG"
                  className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-normal leading-relaxed text-slate-800 focus:border-slate-400 focus:outline-none sm:col-span-2"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Nhóm tuổi
                <input
                  value={draft.age_group}
                  onChange={(e) => setDraft({ ...draft, age_group: e.target.value })}
                  placeholder="VD: nguoi_truong_thanh"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-normal text-slate-800 focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                ID chuyên khoa AI gợi ý
                <input
                  type="number"
                  value={draft.ai_department_id}
                  onChange={(e) => setDraft({ ...draft, ai_department_id: e.target.value })}
                  placeholder="VD: 2"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-normal text-slate-800 focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Mức ưu tiên AI
                <select
                  value={draft.ai_priority_level}
                  onChange={(e) => setDraft({ ...draft, ai_priority_level: e.target.value })}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-800 focus:border-slate-400 focus:outline-none"
                >
                  <option value="">Chưa xác định</option>
                  <option value="P1">P1 - Cấp cứu</option>
                  <option value="P2">P2 - Cần khám sớm</option>
                  <option value="P3">P3 - Thông thường</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Hành động tiếp nhận
                <input
                  value={draft.reception_action}
                  onChange={(e) => setDraft({ ...draft, reception_action: e.target.value })}
                  placeholder="VD: Ưu tiên khám chuyên khoa hô hấp"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-normal text-slate-800 focus:border-slate-400 focus:outline-none"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setDraft(null);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={14} aria-hidden="true" />
                )}
                Lưu chuẩn hóa
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
