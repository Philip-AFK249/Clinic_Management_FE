import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Send } from "lucide-react";
import DoctorHeader from "./components/DoctorHeader";
import PatientQueueDrawer from "./components/PatientQueueDrawer";
import ActivePatientBanner from "./components/ActivePatientBanner";
import AmbientRecordingBar from "./components/AmbientRecordingBar";
import PatientHistoryModal from "./components/PatientHistoryModal";
import WorkspaceSplitView from "./components/WorkspaceSplitView";
import LiveTranscriptPanel from "./components/LiveTranscriptPanel";
import SoapNoteEditor from "./components/SoapNoteEditor";
import { useDoctorQueue } from "./hooks/useDoctorQueue";
import { useAmbientConsultation } from "./hooks/useAmbientConsultation";
import { useDoctorSession } from "./hooks/useDoctorSession";
import { toDiagnoses, toPrescriptionItems } from "./data/rxMapper";
import {
  completeEncounterApi,
  startEncounterApi,
} from "../../services/clinicalApi";
import type { CompleteEncounterPayload } from "../../services/clinicalApi";

/**
 * `PatientRecord.patientId` is the human-facing `FHIR-P-88219` label, while
 * `POST /clinical/encounters/start` wants the numeric `patients.id` the intake
 * service assigned. The digits are trailing, so they can be read back off the
 * label; anything unparseable falls back to 1 so the encounter still opens and
 * the backend owns the correction.
 */
function parsePatientId(patientId: string | undefined): number {
  const match = /(\d+)\s*$/.exec(patientId ?? "");
  const parsed = match ? Number(match[1]) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default function DoctorEHRPage() {
  const [historyOpen, setHistoryOpen] = useState(false);
  /**
   * The bệnh án opened for the patient in the room. Held in state (not a
   * module constant) because it belongs to one consultation: it is created when
   * the patient is called in and released as soon as the note is signed.
   */
  const [currentEncounterId, setCurrentEncounterId] = useState<number | null>(
    null,
  );
  const [isStartingEncounter, setIsStartingEncounter] = useState(false);
  const [isSubmittingEncounter, setIsSubmittingEncounter] = useState(false);

  const queue = useDoctorQueue();
  const session = useDoctorSession();
  const {
    status, elapsedSeconds, waveform, revealedLines, soapDraft, setSoapDraft,
    icdAccepted, setIcdAccepted, icdSuggestions, rxLines, setRxLines,
    start, pause, resume, finish, approve,
  } = useAmbientConsultation();

  const patient = queue.activePatient;
  // Primitives, not the record itself: the queue polls every 8s and rebuilds
  // the object each time, so depending on it would tear down the start request
  // mid-flight.
  const ticketNumber = patient?.ticketNumber ?? null;
  const patientName = patient?.name ?? "";
  const patientId = patient ? parsePatientId(patient.patientId) : 1;
  const insuranceCode = patient?.insuranceCode ?? "";

  /** Ticket whose encounter has already been opened; blocks duplicate POSTs. */
  const startedTicketRef = useRef<string | null>(null);
  /** Ticket already reported as un-openable, so one outage = one toast. */
  const warnedTicketRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ticketNumber) {
      // The room is empty: the next patient gets their own encounter.
      startedTicketRef.current = null;
      warnedTicketRef.current = null;
      return;
    }
    if (currentEncounterId !== null) return;
    if (startedTicketRef.current === ticketNumber) return;

    startedTicketRef.current = ticketNumber;
    setIsStartingEncounter(true);

    // No cleanup flag on purpose: the effect re-runs on every queue poll (the
    // ref above is what stops duplicates), and cancelling here would strand a
    // request that resolves right after a poll landed.
    void startEncounterApi({
      ticketNumber,
      patientId,
      patientName,
      doctorId: session.doctorId,
      doctorName: session.profile.fullName,
      departmentId: session.profile.departmentId,
      ...(insuranceCode && insuranceCode !== "Chưa cập nhật"
        ? { insuranceCode }
        : {}),
    }).then(
      (encounter) => {
        setIsStartingEncounter(false);
        setCurrentEncounterId(encounter.encounterId);
      },
      (cause: unknown) => {
        setIsStartingEncounter(false);
        // Release the ref so the next queue poll retries the same ticket.
        startedTicketRef.current = null;
        if (warnedTicketRef.current === ticketNumber) return;
        warnedTicketRef.current = ticketNumber;
        toast.error(
          cause instanceof Error
            ? `Không mở được bệnh án cho ${patientName}: ${cause.message}`
            : "Không mở được bệnh án cho bệnh nhân hiện tại.",
          { duration: 6000 },
        );
      },
    );
  }, [
    currentEncounterId,
    insuranceCode,
    patientId,
    patientName,
    queue.lastUpdatedAt,
    session.doctorId,
    session.profile.departmentId,
    session.profile.fullName,
    ticketNumber,
  ]);

  const handleApprove = useCallback(async () => {
    if (status !== "DRAFT_READY" || !patient) return;

    if (currentEncounterId === null) {
      toast.error(
        isStartingEncounter
          ? "Bệnh án đang được mở, vui lòng chờ vài giây rồi phê duyệt."
          : "Chưa mở được bệnh án trên ClinicalConsultationService. Vui lòng thử lại.",
        { duration: 5000 },
      );
      return;
    }

    const diagnoses = toDiagnoses(icdAccepted);
    if (diagnoses.length === 0) {
      toast.error(
        "Vui lòng chọn ít nhất 01 mã chẩn đoán ICD-10 trước khi phê duyệt bệnh án.",
        { duration: 5000 },
      );
      return;
    }

    const vitals = patient.vitals;
    const vitalsRecorded = patient.vitalsRecorded !== false;
    const payload: CompleteEncounterPayload = {
      subjective: soapDraft.subjective,
      objective: soapDraft.objective,
      assessment: soapDraft.assessment,
      plan: soapDraft.plan,
      // Unmeasured vitals must stay off the record rather than be sent as 0.
      ...(vitalsRecorded && vitals.bp ? { bloodPressure: vitals.bp } : {}),
      ...(vitalsRecorded && vitals.hr > 0 ? { heartRate: vitals.hr } : {}),
      ...(vitalsRecorded && vitals.temp ? { temperature: vitals.temp } : {}),
      ...(vitalsRecorded && vitals.spo2 > 0 ? { spo2: vitals.spo2 } : {}),
      diagnoses,
      prescriptionItems: toPrescriptionItems(rxLines),
      patientAllergies: patient.allergies.map((allergy) => allergy.name),
    };

    setIsSubmittingEncounter(true);
    try {
      await completeEncounterApi(currentEncounterId, payload);
      toast.success(
        "Bệnh án đã được phê duyệt và đơn thuốc đã chuyển xuống Quầy Dược.",
        { duration: 4000 },
      );
      approve();
      queue.finishEncounter(String(currentEncounterId));
      setCurrentEncounterId(null);
      startedTicketRef.current = null;
      warnedTicketRef.current = null;
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Không phê duyệt được bệnh án. Vui lòng thử lại.",
        { duration: 6000 },
      );
    } finally {
      setIsSubmittingEncounter(false);
    }
  }, [
    approve,
    currentEncounterId,
    icdAccepted,
    isStartingEncounter,
    patient,
    queue,
    rxLines,
    soapDraft,
    status,
  ]);

  function handleSaveDraft() {
    toast.info("Đã lưu bệnh án nháp (chưa hoàn tất). Bác sĩ có thể tiếp tục sau.");
  }

  function handleRefer() {
    toast.info("Đã kích hoạt quy trình chuyển tuyến / hội chẩn Bệnh viện.");
  }

  const isBusy = isSubmittingEncounter || isStartingEncounter;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-light text-slate-900">
      <DoctorHeader
        waitingCount={queue.waitingCount}
        emergencyCount={queue.emergencyCount}
      />

      <div className="flex min-h-0 flex-1">
        {/* Priority queue drawer */}
        <PatientQueueDrawer
          queue={queue.queue}
          activePatient={queue.activePatient}
          source={queue.source}
          isRefreshing={queue.isRefreshing}
          isCalling={queue.isCalling}
          onCallNext={() => void queue.callNext()}
          onSkip={(ticketNumber) => void queue.skipPatient(ticketNumber)}
          onRefresh={queue.refresh}
        />

        {/* Main workspace */}
        <main className="flex min-w-0 flex-1 flex-col">
          {queue.activePatient ? (
            <>
              <ActivePatientBanner
                patient={queue.activePatient}
                onOpenHistory={() => setHistoryOpen(true)}
              />
              <AmbientRecordingBar
                status={status}
                elapsedSeconds={elapsedSeconds}
                waveform={waveform}
                onStart={start}
                onPause={pause}
                onResume={resume}
                onFinish={finish}
              />
              <WorkspaceSplitView
                left={
                  <LiveTranscriptPanel
                    status={status}
                    revealedLines={revealedLines}
                    patient={queue.activePatient}
                  />
                }
                right={
                  <SoapNoteEditor
                    status={status}
                    soapDraft={soapDraft}
                    setSoapDraft={setSoapDraft}
                    icdSuggestions={icdSuggestions}
                    icdAccepted={icdAccepted}
                    setIcdAccepted={setIcdAccepted}
                    rxLines={rxLines}
                    setRxLines={setRxLines}
                    allergies={queue.activePatient.allergies}
                  />
                }
              />

              {/* Approval dock */}
              <footer className="flex h-14 shrink-0 items-center justify-between gap-3 border-t border-slate-200/80 bg-white px-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Lưu Bệnh án Nháp / Chưa hoàn tất
                  </button>
                  <button
                    type="button"
                    onClick={handleRefer}
                    className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Chuyển tuyến Bệnh viện / Hội chẩn
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {status === "DRAFT_READY"
                      ? currentEncounterId === null
                        ? isStartingEncounter
                          ? "Đang mở bệnh án trên hệ thống..."
                          : "Chưa có bệnh án trên hệ thống"
                        : "Bệnh án AI chờ bác sĩ kiểm duyệt"
                      : status === "APPROVED"
                        ? "Ca khám đã hoàn tất"
                        : "Đang chờ bệnh án AI"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleApprove()}
                    disabled={status !== "DRAFT_READY" || isBusy}
                    className="inline-flex h-12 items-center gap-2 rounded-lg bg-teal-600 px-8 text-base font-bold text-white shadow-md transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    ✍️ Phê Duyệt Bệnh Án &amp; Đẩy Đơn Xuống Quầy Dược
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <div>
                <p className="text-base font-bold text-slate-900">
                  {queue.source === "live"
                    ? "Hàng đợi đã sẵn sàng cho bệnh nhân kế tiếp"
                    : "Chưa có bệnh nhân nào trong hàng đợi"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {queue.source === "live"
                    ? 'Nhấn "Gọi Bệnh Nhân Tiếp Theo" trong khung hàng đợi để bắt đầu ca khám.'
                    : "Hãy cấp số cho bệnh nhân tại Quầy Tiếp Đón hoặc tại Kiosk. Phiếu sẽ xuất hiện tại đây trong vòng 8 giây."}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      <PatientHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        patient={queue.activePatient}
      />
    </div>
  );
}
