import { FileText } from "lucide-react";
import { useState } from "react";
import type {
  PatientRecord,
  TranscriptEntity,
  TranscriptEntityType,
  TranscriptLine,
} from "../data/doctorMockData";
import type { ConsultationStatus } from "../hooks/useAmbientConsultation";

interface LiveTranscriptPanelProps {
  status: ConsultationStatus;
  revealedLines: TranscriptLine[];
  patient: PatientRecord | null;
}

const ENTITY_STYLES: Record<
  TranscriptEntityType,
  { label: string; className: string }
> = {
  SYMPTOM: {
    label: "Triệu chứng",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  DURATION: {
    label: "Thời gian",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
  VITALS: {
    label: "Sinh hiệu",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  ALLERGY: {
    label: "Dị ứng",
    className: "border-red-300 bg-red-50 text-red-700",
  },
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightEntities(text: string, entities: TranscriptEntity[]) {
  if (entities.length === 0) return <>{text}</>;
  const pattern = new RegExp(
    `(${entities.map((e) => escapeRegex(e.term)).join("|")})`,
    "gi",
  );
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, index) => {
        const match = entities.find(
          (e) => e.term.toLowerCase() === part.toLowerCase(),
        );
        if (match) {
          const style = ENTITY_STYLES[match.type];
          return (
            <mark
              key={index}
              className={`mx-0.5 rounded px-0.5 font-semibold ${style.className}`}
            >
              {part}
            </mark>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

type TranscriptTab = "LIVE" | "PREVIOUS";

/** Speaker avatar: the doctor is teal, the patient slate-blue. */
function SpeakerAvatar({ speaker }: { speaker: TranscriptLine["speaker"] }) {
  const isDoctor = speaker === "DOCTOR";
  return (
    <span
      aria-hidden="true"
      title={isDoctor ? "Bác sĩ" : "Bệnh nhân"}
      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
        isDoctor ? "bg-teal-600 text-white" : "bg-slate-500 text-white"
      }`}
    >
      {isDoctor ? "BS" : "BN"}
    </span>
  );
}

export default function LiveTranscriptPanel({
  status,
  revealedLines,
  patient,
}: LiveTranscriptPanelProps) {
  const [tab, setTab] = useState<TranscriptTab>("LIVE");
  const recording = status === "RECORDING";
  const analyzing = status === "ANALYZING";

  return (
    <div className="flex h-full flex-col">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-slate-200/80 px-3 py-2">
        <button
          type="button"
          onClick={() => setTab("LIVE")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === "LIVE"
              ? "bg-teal-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Live Audio Transcript {recording && <span className="ml-1 text-red-500">●</span>}
        </button>
        <button
          type="button"
          onClick={() => setTab("PREVIOUS")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === "PREVIOUS"
              ? "bg-teal-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Đơn thuốc cũ &amp; Kết quả CLS (OCR)
        </button>
      </div>

      {/* Live tab */}
      {tab === "LIVE" && (
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {revealedLines.length === 0 && (
            <p className="px-2 py-8 text-center text-xs text-slate-400">
              {recording
                ? "Đang thu âm cuộc khám — hội thoại sẽ hiển thị ngay sau khi AI bóc băng."
                : analyzing
                  ? "Đang bóc băng hội thoại thành từng lời thoại có phân biệt bác sĩ / bệnh nhân..."
                  : "Bật Ghi Âm để ghi lại cuộc đối thoại lâm sàng; biên bản sẽ hiển thị tại đây."}
            </p>
          )}
          {revealedLines.map((line) => (
            <div key={line.id} className="flex gap-2">
              <SpeakerAvatar speaker={line.speaker} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-bold ${
                      line.speaker === "DOCTOR"
                        ? "text-teal-700"
                        : "text-slate-500"
                    }`}
                  >
                    {line.speaker === "DOCTOR" ? "Bác sĩ" : "Bệnh nhân"}
                    <span className="ml-1.5 font-medium text-slate-400">
                      {line.timeOffset}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {line.entities.map((entity, index) => {
                      const style = ENTITY_STYLES[entity.type];
                      return (
                        <span
                          key={`${line.id}-${index}`}
                          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${style.className}`}
                        >
                          [{style.label}: {entity.term}]
                        </span>
                      );
                    })}
                  </span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-700">
                  {highlightEntities(line.text, line.entities)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Previous tab */}
      {tab === "PREVIOUS" && patient && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                Lịch sử khám bệnh ({patient.pastEncounters.length})
              </p>
              <div className="mt-1.5 space-y-2">
                {patient.pastEncounters.map((encounter) => (
                  <div
                    key={encounter.id}
                    className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-mono">{encounter.id}</span>
                      <span>{encounter.date}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-900">
                      {encounter.complaint}
                    </p>
                    <p className="text-xs font-medium text-teal-700">
                      {encounter.diagnosis}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                <FileText className="h-3 w-3" />
                Đơn thuốc cũ (OCR) ({patient.scannedOldPrescriptions.length})
              </p>
              <div className="mt-1.5 space-y-2">
                {patient.scannedOldPrescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-mono">{rx.id}</span>
                      <span>{rx.date}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-900">
                      {rx.medication}
                    </p>
                    <p className="text-xs text-slate-500">
                      {rx.dosage} &middot; OCR {rx.ocrConfidence}%
                    </p>
                  </div>
                ))}
                {patient.scannedOldPrescriptions.length === 0 && (
                  <p className="text-xs text-slate-400">
                    Không có đơn thuốc cũ nào được quét.
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-teal-700">
                <FileText className="h-3 w-3" />
                Kết quả xét nghiệm ({patient.labReports.length})
              </p>
              <div className="mt-1.5 space-y-2">
                {patient.labReports.map((lab) => (
                  <div
                    key={lab.id}
                    className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-card"
                  >
                    <p className="text-xs font-semibold text-slate-700">
                      {lab.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {lab.result} &middot; {lab.date}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}