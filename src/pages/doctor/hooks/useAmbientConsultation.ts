import { useCallback, useEffect, useRef, useState } from "react";
import { useDrugCatalog } from "../../../hooks/useDrugCatalog";
import { resolveRxSeeds } from "../data/rxMapper";
import {
  AI_ICD_SUGGESTIONS,
  AI_RX_SEEDS,
  AI_SOAP_DRAFT,
  TRANSCRIPT_LINES,
} from "../data/doctorMockData";
import type {
  IcdCode,
  RxLine,
  SoapDraft,
  TranscriptLine,
} from "../data/doctorMockData";

export type ConsultationStatus =
  | "IDLE"
  | "RECORDING"
  | "PAUSED"
  | "ANALYZING"
  | "DRAFT_READY"
  | "APPROVED";

const WAVE_BARS = 12;

function emptyDraft(): SoapDraft {
  return { subjective: "", objective: "", assessment: "", plan: "" };
}

export function useAmbientConsultation() {
  const [status, setStatus] = useState<ConsultationStatus>("IDLE");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(() =>
    Array.from({ length: WAVE_BARS }, () => 6),
  );
  const [revealedLines, setRevealedLines] = useState<TranscriptLine[]>([]);
  const [soapDraft, setSoapDraft] = useState<SoapDraft>(emptyDraft);
  const [icdAccepted, setIcdAccepted] = useState<IcdCode[]>([]);
  const [icdSuggestions] = useState<IcdCode[]>(AI_ICD_SUGGESTIONS);
  const [rxLines, setRxLines] = useState<RxLine[]>([]);

  // The AI only proposes drug *names*; the prescription that reaches
  // ClinicalConsultationService needs the real `drugs.id`, so the draft is
  // resolved against the live formulary as soon as the transcript is analysed.
  const catalog = useDrugCatalog();

  const timerRef = useRef<number | null>(null);
  const waveRef = useRef<number | null>(null);
  const transcriptRef = useRef<number | null>(null);
  const analyzeRef = useRef<number | null>(null);
  const approveRef = useRef<number | null>(null);
  const revealedIndexRef = useRef(0);

  const startTranscriptTicker = useCallback(() => {
    if (transcriptRef.current !== null) return;
    transcriptRef.current = window.setInterval(() => {
      const line = TRANSCRIPT_LINES[revealedIndexRef.current];
      if (!line) {
        if (transcriptRef.current !== null) {
          window.clearInterval(transcriptRef.current);
          transcriptRef.current = null;
        }
        return;
      }
      revealedIndexRef.current += 1;
      setRevealedLines((prev) => [...prev, line]);
    }, 2400);
  }, []);

  const clearIntervals = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (waveRef.current !== null) window.clearInterval(waveRef.current);
    if (transcriptRef.current !== null)
      window.clearInterval(transcriptRef.current);
    timerRef.current = null;
    waveRef.current = null;
    transcriptRef.current = null;
  }, []);

  const clearTimeouts = useCallback(() => {
    if (analyzeRef.current !== null) window.clearTimeout(analyzeRef.current);
    if (approveRef.current !== null) window.clearTimeout(approveRef.current);
    analyzeRef.current = null;
    approveRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearIntervals();
      clearTimeouts();
    };
  }, [clearIntervals, clearTimeouts]);

  const start = useCallback(() => {
    setStatus("RECORDING");
    setElapsedSeconds(0);
    setRevealedLines([]);
    revealedIndexRef.current = 0;
    setWaveform(Array.from({ length: WAVE_BARS }, () => 6));

    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    waveRef.current = window.setInterval(() => {
      setWaveform(() =>
        Array.from({ length: WAVE_BARS }, () => 5 + Math.round(Math.random() * 17)),
      );
    }, 350);

    startTranscriptTicker();
  }, [startTranscriptTicker]);

  const pause = useCallback(() => {
    clearIntervals();
    setStatus("PAUSED");
  }, [clearIntervals]);

  const resume = useCallback(() => {
    setStatus("RECORDING");
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    waveRef.current = window.setInterval(() => {
      setWaveform(() =>
        Array.from({ length: WAVE_BARS }, () => 5 + Math.round(Math.random() * 17)),
      );
    }, 350);
    startTranscriptTicker();
  }, [startTranscriptTicker]);

  const finish = useCallback(() => {
    clearIntervals();
    setStatus("ANALYZING");
    analyzeRef.current = window.setTimeout(() => {
      setSoapDraft(AI_SOAP_DRAFT);
      setIcdAccepted([]);
      setRxLines(resolveRxSeeds(AI_RX_SEEDS, catalog.drugs));
      setStatus("DRAFT_READY");
      analyzeRef.current = null;
    }, 2000);
  }, [catalog.drugs, clearIntervals]);

  const approve = useCallback(() => {
    clearIntervals();
    clearTimeouts();
    setStatus("APPROVED");
    approveRef.current = window.setTimeout(() => {
      setSoapDraft(emptyDraft());
      setIcdAccepted([]);
      setRxLines([]);
      setRevealedLines([]);
      revealedIndexRef.current = 0;
      setElapsedSeconds(0);
      setStatus("IDLE");
      approveRef.current = null;
    }, 1500);
  }, [clearIntervals, clearTimeouts]);

  return {
    status,
    elapsedSeconds,
    waveform,
    revealedLines,
    soapDraft,
    setSoapDraft,
    icdAccepted,
    setIcdAccepted,
    icdSuggestions,
    rxLines,
    setRxLines,
    start,
    pause,
    resume,
    finish,
    approve,
  };
}