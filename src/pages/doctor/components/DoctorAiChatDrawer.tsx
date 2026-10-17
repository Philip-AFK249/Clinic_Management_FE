import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, Send, X } from "lucide-react";
import { toast } from "sonner";
import { sendCopilotChatApi } from "../../../services/clinicalApi";
import type {
  AmbientPatientContext,
  CopilotChatResponse,
  DiagnosisItem,
  PrescriptionDraftItem,
  SoapNote,
} from "../../../services/clinicalApi";
import { icdSuggestionsToCodes, soapDraftToNote } from "../data/ambientMapper";
import type { IcdCode, SoapDraft } from "../data/doctorMockData";

/** A refined record the doctor can accept back into the workspace. */
export interface CopilotChartUpdate {
  soapNote?: SoapNote;
  icdCodes?: IcdCode[];
  /** Raw gateway draft; the consultation hook binds it to the live formulary. */
  prescriptionDraft?: PrescriptionDraftItem[];
}

interface DoctorAiChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Unacknowledged clinical alerts, rendered as the toggle's badge. */
  alertCount: number;
  hasRedFlags: boolean;
  redFlags: string[];
  onAlertsSeen: () => void;
  onRedFlagsDetected: (flags: string[]) => void;
  patientContext: AmbientPatientContext;
  currentSoap: SoapDraft;
  currentDiagnoses: DiagnosisItem[];
  /** Bind the AI's refined SOAP / ICD-10 / prescription back into the EHR. */
  onApplyUpdate: (update: CopilotChartUpdate) => void;
  /** True while no patient is in the room - nothing to consult about. */
  disabled?: boolean;
}

interface CopilotMessage {
  id: string;
  role: "doctor" | "assistant";
  content: string;
  isRedFlag?: boolean;
  isError?: boolean;
}

const QUICK_PROMPTS = [
  "Bệnh nhân xác nhận đã nhiễm HIV 2 năm, đang dùng ARV.",
  "Đổi sang nhóm kháng sinh không dị ứng.",
  "Tiền sử dùng thuốc hiện tại của bệnh nhân là gì?",
];

let messageSeq = 0;
function nextMessageId(prefix: string): string {
  messageSeq += 1;
  return `${prefix}-${messageSeq}`;
}

/** Fold one copilot answer into a chart update, or `null` when it changed nothing. */
function toChartUpdate(response: CopilotChatResponse): CopilotChartUpdate | null {
  const update: CopilotChartUpdate = {};
  if (response.soap_note) update.soapNote = response.soap_note;

  const icdCodes = icdSuggestionsToCodes(response.icd10_suggestions);
  if (icdCodes.length > 0) update.icdCodes = icdCodes;

  if (response.prescription_draft?.length) {
    update.prescriptionDraft = response.prescription_draft;
  }

  return Object.keys(update).length > 0 ? update : null;
}

export default function DoctorAiChatDrawer({
  open,
  onOpenChange,
  alertCount,
  hasRedFlags,
  redFlags,
  onAlertsSeen,
  onRedFlagsDetected,
  patientContext,
  currentSoap,
  currentDiagnoses,
  onApplyUpdate,
  disabled = false,
}: DoctorAiChatDrawerProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<CopilotChartUpdate | null>(
    null,
  );
  const listRef = useRef<HTMLDivElement | null>(null);

  // A red flag raised mid-turn should interrupt the doctor, not wait to be found.
  useEffect(() => {
    if (alertCount > 0) onOpenChange(true);
  }, [alertCount, onOpenChange]);

  useEffect(() => {
    if (open && alertCount > 0) onAlertsSeen();
  }, [alertCount, onAlertsSeen, open]);

  useEffect(() => {
    const element = listRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [isSending, messages]);

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || isSending || disabled) return;

    setInput("");
    setIsSending(true);
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId("doctor"), role: "doctor", content: message },
    ]);

    try {
      const response = await sendCopilotChatApi({
        message,
        currentSoap: soapDraftToNote(currentSoap),
        currentDiagnoses,
        patientContext,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId("assistant"),
          role: "assistant",
          content:
            response.reply?.trim() ||
            "Trợ lý AI chưa có đề xuất nào cho thông tin vừa bổ sung.",
          isRedFlag: response.has_red_flags === true,
        },
      ]);

      const update = toChartUpdate(response);
      if (update) setPendingUpdate(update);

      if (response.has_red_flags === true) {
        onRedFlagsDetected(response.red_flags ?? []);
      }
    } catch (cause) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId("assistant"),
          role: "assistant",
          content:
            "Xin lỗi, trợ lý AI đang gặp sự cố kết nối. Bác sĩ thử lại sau ít phút.",
          isError: true,
        },
      ]);
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Không gửi được câu hỏi đến Trợ lý AI Copilot.",
        { duration: 6000 },
      );
    } finally {
      setIsSending(false);
    }
  }

  function applyUpdate() {
    if (!pendingUpdate) return;
    onApplyUpdate(pendingUpdate);
    setPendingUpdate(null);
    toast.success(
      "Đã cập nhật hồ sơ bệnh án theo phản hồi của Trợ lý AI Copilot.",
      { duration: 4000 },
    );
  }

  // No floating "Trợ lý AI Copilot" toggle: the workspace keeps its own space
  // and the panel only shows up when a clinical red flag opens it.
  if (!open) return null;

  return (
    <aside
      className={`fixed bottom-20 right-6 z-40 flex h-[64vh] w-[26rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border bg-white shadow-elevated ${
        hasRedFlags
          ? "border-amber-300 ring-2 ring-amber-300"
          : "border-slate-200"
      }`}
      aria-label="Trợ lý AI Copilot"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-200/80 bg-teal-600 px-4 py-3 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
          <Bot className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Trợ lý AI Copilot</p>
          <p className="truncate text-[11px] text-teal-100">
            {patientContext.patientName
              ? `Hội chẩn cùng ${patientContext.patientName}`
              : "Hội chẩn AI theo thời gian thực"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Đóng Trợ lý AI Copilot"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Red-flag banner */}
      {hasRedFlags && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="flex items-start gap-1.5 text-xs font-bold text-amber-800">
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              ⚠️ Cảnh báo lâm sàng: Phát hiện dấu hiệu suy giảm miễn dịch /
              bệnh truyền nhiễm tiềm ẩn.
            </span>
          </p>
          {redFlags.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {redFlags.map((flag) => (
                <li
                  key={flag}
                  className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                >
                  {flag}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Thread */}
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-2 px-1 py-4 text-center">
            <p className="text-xs font-semibold text-slate-600">
              Bác sĩ bổ sung thông tin lâm sàng mà micrô không nghe được, AI sẽ
              đề xuất chỉnh sửa bệnh án tương ứng.
            </p>
            <p className="text-[11px] text-slate-400">
              Ví dụ: tiền sử dùng ARV, đổi kháng sinh do dị ứng, tái khám theo
              dõi phác đồ...
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "doctor" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                message.role === "doctor"
                  ? "rounded-br-sm bg-teal-600 text-white"
                  : message.isError
                    ? "rounded-bl-sm border border-red-200 bg-red-50 text-red-700"
                    : message.isRedFlag
                      ? "rounded-bl-sm border border-amber-300 bg-amber-50 text-amber-900"
                      : "rounded-bl-sm border border-slate-200 bg-slate-50 text-slate-800"
              }`}
            >
              {message.role === "assistant" && message.isRedFlag && (
                <p className="mb-1 flex items-center gap-1 text-[11px] font-bold text-amber-800">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Cảnh báo lâm sàng
                </p>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <span className="rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              Trợ lý AI đang phân tích...
            </span>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && !disabled && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-slate-200/80 px-3 py-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendMessage(prompt)}
              className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-800 transition-colors hover:bg-teal-100"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Refined record waiting to be bound */}
      {pendingUpdate && (
        <div className="shrink-0 border-t border-teal-200 bg-teal-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-teal-900">
              AI đã soạn bản chỉnh sửa bệnh án mới. Bác sĩ kiểm tra rồi bấm
              Cập nhật để đồng bộ.
            </p>
            <button
              type="button"
              onClick={applyUpdate}
              className="inline-flex h-8 shrink-0 items-center rounded-lg bg-teal-600 px-3 text-[11px] font-bold text-white transition-colors hover:bg-teal-700"
            >
              Cập nhật hồ sơ bệnh án
            </button>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-slate-200/80 bg-white p-3">
        {disabled ? (
          <p className="text-center text-xs text-slate-400">
            Hãy chọn bệnh nhân trong phòng khám để trò chuyện với Trợ lý AI.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              rows={2}
              placeholder="Bổ sung thông tin lâm sàng cho AI Copilot..."
              className="min-h-10 flex-1 resize-none rounded-lg border border-slate-200 bg-white p-2 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={isSending || !input.trim()}
              aria-label="Gửi câu hỏi cho Trợ lý AI Copilot"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
