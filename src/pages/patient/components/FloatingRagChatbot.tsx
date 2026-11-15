import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, MessageSquare, Send, X } from "lucide-react";
import { answerFromKnowledgeBase } from "../data/patientMockRecords";

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  source?: string;
}

const QUICK_PROMPTS = [
  "Thẻ BHYT trái tuyến có được chi trả không?",
  "Bác sĩ Tuấn có lịch khám vào Chủ Nhật không?",
  "Bảng giá xét nghiệm dị ứng chi tiết?",
];

const WELCOME_TEXT =
  "Xin chào! Tôi là trợ lý ảo của Smart Clinic. Tôi có thể hỗ trợ bạn về quy trình khám, BHYT, lịch bác sĩ và bảng giá dịch vụ.";

export default function FloatingRagChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "bot", text: WELCOME_TEXT },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const streamRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current !== null) window.clearInterval(streamRef.current);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const handleSend = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || loading || streamRef.current !== null) return;

      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: "user", text },
      ]);
      setInput("");
      setLoading(true);

      const reply = answerFromKnowledgeBase(text);
      const botId = `bot-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: botId, role: "bot", text: "", source: reply.source },
      ]);

      let cursor = 0;
      streamRef.current = window.setInterval(() => {
        cursor += 2;
        const chunk = reply.answer.slice(0, cursor);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botId ? { ...msg, text: chunk } : msg,
          ),
        );
        if (cursor >= reply.answer.length) {
          if (streamRef.current !== null) {
            window.clearInterval(streamRef.current);
            streamRef.current = null;
          }
          setLoading(false);
        }
      }, 26);
    },
    [loading],
  );

  return (
    <>
      {open && (
        <div className="fixed bottom-44 right-4 z-50 flex h-[calc(100dvh-12rem)] max-h-[520px] w-96 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl sm:right-6 md:bottom-24">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-200/80 bg-clinical-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold">Trợ lý Ảo Phòng Khám (AI Assistant)</p>
                <p className="flex items-center gap-1 text-xs text-clinical-100">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-300"
                    aria-hidden="true"
                  />
                  Sẵn sàng hỗ trợ
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng trợ lý ảo"
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-2 overflow-y-auto bg-surface-light p-3"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-cta text-white"
                      : "border border-slate-200 bg-white text-slate-700 shadow-card"
                  }`}
                >
                  <p>{msg.text}</p>
                  {msg.source && (
                    <span className="mt-1.5 inline-block rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                      [Nguồn: {msg.source}]
                    </span>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <p className="text-xs text-slate-400 animate-pulse">
                Phòng khám đang soạn câu trả lời...
              </p>
            )}
          </div>

          {/* Quick action prompts */}
          <div className="flex gap-1.5 overflow-x-auto border-t border-slate-200/80 bg-white px-3 py-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSend(prompt)}
                className="shrink-0 rounded-full border border-clinical-200 bg-clinical-50 px-3 py-1.5 text-xs font-medium text-clinical-700 transition-colors hover:bg-clinical-100"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-slate-200/80 bg-white px-3 py-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend(input);
              }}
              placeholder="Hỏi về thủ tục khám..."
              className="h-11 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-clinical-500 focus:outline-none focus:ring-2 focus:ring-clinical-500/20"
            />
            <button
              type="button"
              onClick={() => handleSend(input)}
              disabled={!input.trim() || loading}
              aria-label="Gửi tin nhắn"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-clinical-600 text-white transition-colors hover:bg-clinical-700 disabled:cursor-not-allowed disabled:bg-slate-200"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <p className="rounded-b-2xl bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-400">
            Trợ lý ảo cung cấp thông tin thủ tục hành chính, không đưa ra chỉ
            định thuốc.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Đóng trợ lý ảo phòng khám" : "Mở trợ lý ảo phòng khám"}
        className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-clinical-600 text-white shadow-elevated transition-colors hover:bg-clinical-700 sm:right-6 md:bottom-6"
      >
        {open ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <MessageSquare className="h-6 w-6" aria-hidden="true" />
        )}
      </button>
    </>
  );
}