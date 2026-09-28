import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, MapPin } from "lucide-react";
import KioskHeader from "./components/KioskHeader";
import KioskAttractScreen from "./components/KioskAttractScreen";
import KioskQrScanModal from "./components/KioskQrScanModal";
import KioskCardOcrModal from "./components/KioskCardOcrModal";
import KioskSymptomTriageStep from "./components/KioskSymptomTriageStep";
import KioskTicketDispenserModal from "./components/KioskTicketDispenserModal";
import KioskWayfindingModal from "./components/KioskWayfindingModal";
import { useKioskSession } from "./hooks/useKioskSession";
import { useKioskInactivityTimer } from "./hooks/useKioskInactivityTimer";
import {
  ESTIMATED_WAIT_MINUTES,
  KIOSK_PATIENT,
  PATIENTS_AHEAD,
} from "./data/kioskMockData";

const INACTIVITY_TIMEOUT_MS = 45_000;
const RESET_TIMEOUT_MS = 15_000;

export default function KioskPage() {
  const {
    step,
    selection,
    patient,
    ticket,
    isIssuing,
    startQrScan,
    startCardOcr,
    handleQrMatched,
    handleCardOcrComplete,
    selectSymptom,
    proceedToPrint,
    handleTicketIssued,
    reset,
  } = useKioskSession();

  const [activityKey, setActivityKey] = useState(0);
  const [resetCountdown, setResetCountdown] = useState(RESET_TIMEOUT_MS / 1000);
  const [ticketIssued, setTicketIssued] = useState(false);
  const [showWayfinding, setShowWayfinding] = useState(false);
  const inactivityKeyRef = useRef(0);

  const bumpActivity = useCallback(() => {
    inactivityKeyRef.current += 1;
    setActivityKey(inactivityKeyRef.current);
  }, []);

  useKioskInactivityTimer(
    INACTIVITY_TIMEOUT_MS,
    reset,
    step !== "IDLE" && !showWayfinding,
    activityKey,
  );

  const busy = step === "PRINTING_TICKET" || step === "SUCCESS_SUMMARY";

  useEffect(() => {
    window.addEventListener("click", bumpActivity);
    window.addEventListener("keydown", bumpActivity);
    window.addEventListener("touchstart", bumpActivity);
    return () => {
      window.removeEventListener("click", bumpActivity);
      window.removeEventListener("keydown", bumpActivity);
      window.removeEventListener("touchstart", bumpActivity);
    };
  }, [bumpActivity]);

  useEffect(() => {
    if (!busy) return undefined;
    const start = Date.now();
    const initial = Math.ceil(RESET_TIMEOUT_MS / 1000);
    const tick = () => {
      const remaining = Math.max(
        0,
        initial - Math.floor((Date.now() - start) / 1000),
      );
      setResetCountdown(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        setTicketIssued(false);
        reset();
      }
    };
    const interval = window.setInterval(tick, 250);
    return () => {
      window.clearInterval(interval);
      setResetCountdown(initial);
    };
  }, [busy, reset]);

  const handleWayfinding = useCallback(() => {
    setShowWayfinding(true);
  }, []);

  const closeWayfinding = useCallback(() => {
    setShowWayfinding(false);
    bumpActivity();
  }, [bumpActivity]);

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-surface-light"
      onPointerDown={bumpActivity}
    >
      <KioskHeader onReset={reset} />

      <main className="flex min-h-0 flex-1">
        {step === "IDLE" && (
          <KioskAttractScreen
            onQrCheckIn={startQrScan}
            onWalkIn={startCardOcr}
            onWayfinding={handleWayfinding}
          />
        )}

        {step === "SYMPTOM_TRIAGE" && (
          <KioskSymptomTriageStep
            selectedSymptom={selection.symptom}
            onSelectSymptom={selectSymptom}
            onPrint={proceedToPrint}
          />
        )}

        {step === "SUCCESS_SUMMARY" && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-16 w-16 text-emerald-600" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-bold text-slate-900">
              {ticketIssued ? "Xuất Phiếu Thành Công" : "Đang Xuất Phiếu..."}
            </h1>
            <p className="text-lg text-slate-600">
              {KIOSK_PATIENT.patientName} • Số thứ tự{" "}
              <span className="font-bold text-clinical-700">
                {ticket?.ticketNumber ?? "…"}
              </span>
            </p>
            {ticket && (
              <p className="text-base font-semibold text-slate-700">
                {ticket.departmentName} • {ticket.roomNumber} • {ticket.doctorName}
              </p>
            )}
            <div className="flex items-center gap-4">
              <p className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                <Clock className="h-4 w-4 text-clinical-600" aria-hidden="true" />
                ~{ESTIMATED_WAIT_MINUTES} phút
              </p>
              <p className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                <MapPin className="h-4 w-4 text-clinical-600" aria-hidden="true" />
                {PATIENTS_AHEAD} người phía trước
              </p>
            </div>
            <p className="text-sm text-slate-400">
              {ticketIssued
                ? `Quay về màn hình chính sau ${resetCountdown}s`
                : isIssuing
                  ? "Đang đồng bộ với hệ thống tiếp đón..."
                  : "Vui lòng đợi giây lát..."}
            </p>
            <button
              type="button"
              onClick={handleWayfinding}
              className="inline-flex h-16 items-center justify-center gap-2 rounded-xl bg-clinical-600 px-8 text-lg font-bold text-white shadow-md transition-all hover:bg-clinical-700 active:scale-95"
            >
              <MapPin className="h-5 w-5" aria-hidden="true" />
              🗺️ Xem Chỉ Đường Đến Phòng Khám
            </button>
          </div>
        )}
      </main>

      {step === "QR_SCAN" && (
        <KioskQrScanModal
          patient={patient}
          onClose={reset}
          onVerified={() => {
            handleQrMatched();
          }}
        />
      )}

      {step === "CARD_OCR" && (
        <KioskCardOcrModal
          patient={patient}
          onClose={reset}
          onComplete={handleCardOcrComplete}
        />
      )}

      {step === "PRINTING_TICKET" && (
        <KioskTicketDispenserModal
          patient={patient}
          symptom={selection.symptom}
          ticket={ticket}
          isIssuing={isIssuing}
          onIssued={() => {
            setTicketIssued(true);
            handleTicketIssued();
          }}
          onWayfinding={handleWayfinding}
          onClose={reset}
          countdown={resetCountdown}
        />
      )}

      {showWayfinding && <KioskWayfindingModal onClose={closeWayfinding} />}

      {busy && (
        <footer className="shrink-0 border-t border-slate-200/80 bg-white px-6 py-2 text-center text-xs text-slate-400">
          Trình duyệt giữ phiên an toàn • Mọi thao tác trên kiosk đều được ghi
          nhận phục vụ tiếp đón
        </footer>
      )}
    </div>
  );
}