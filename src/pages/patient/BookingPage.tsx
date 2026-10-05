import { useCallback, useState, type FormEvent } from "react";
import { Calendar, ChevronLeft, Check, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import PatientNavbar from "./components/PatientNavbar";
import PatientFooter from "./components/PatientFooter";
import SymptomsStep from "./components/SymptomsStep";
import BookingIdentityFields from "./components/BookingIdentityFields";
import BookingTicketModal from "./components/BookingTicketModal";
import FloatingRagChatbot from "./components/FloatingRagChatbot";
import {
  CLINIC_SERVICES,
  resolveDoctorForService,
} from "./data/clinicContent";
import { triageSymptoms } from "./data/patientMockRecords";
import { writeActiveBooking } from "./data/activeBooking";
import type { BookingIdentityFieldsValue } from "./components/BookingIdentityFields";
import type { Service } from "./data/clinicContent";
import type { ActiveAppointment, BhyTelemetry } from "./data/patientMockRecords";

const TIME_SLOTS = [
  "08:30",
  "09:30",
  "10:30",
  "11:30",
  "14:00",
  "15:30",
  "16:30",
  "17:30",
];

const STEP_LABELS = ["Triệu chứng", "Chuyên khoa", "Xác nhận"];

/** The booking form, patient identity included. */
interface BookingFormData extends BookingIdentityFieldsValue {
  /** True once a card has been read back through the OCR service. */
  isOcrVerified: boolean;
}

const EMPTY_FORM: BookingFormData = {
  fullName: "",
  phone: "",
  insuranceCode: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  initialHospitalCode: "",
  isOcrVerified: false,
};

export default function BookingPage() {
  const [step, setStep] = useState(0);
  const [symptoms, setSymptoms] = useState("");
  const [deptIdx, setDeptIdx] = useState<number | null>(null);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [formData, setFormData] = useState<BookingFormData>(EMPTY_FORM);
  const [ticket, setTicket] = useState<ActiveAppointment | null>(null);

  const suggestion = triageSymptoms(symptoms);
  const suggestedIdx = suggestion
    ? CLINIC_SERVICES.findIndex((s) => s.title === suggestion.department)
    : null;

  /** Type-safe single-field write, so the identity inputs and the scan share one setter. */
  function setFormField<K extends keyof BookingFormData>(
    field: K,
    next: BookingFormData[K],
  ) {
    setFormData((prev) => ({ ...prev, [field]: next }));
  }

  /**
   * Bind a scanned card into the booking form.
   *
   * Every extracted field falls back to the value already in the form, so a
   * rescan never wipes something the patient typed or corrected by hand - an
   * unreadable field simply leaves the previous value standing. `phone` is
   * deliberately not mapped: a BHYT card carries no phone number, so a scan
   * must not disturb the one the patient entered.
   */
  const handleOcrExtracted = useCallback((info: BhyTelemetry) => {
    setFormData((prev) => ({
      ...prev,
      fullName: info.fullName?.trim() || prev.fullName,
      insuranceCode: info.insuranceCode?.trim() || prev.insuranceCode,
      // `ngay_sinh_iso` is already `YYYY-MM-DD`, which is what the date input needs.
      dateOfBirth: info.dateOfBirth || prev.dateOfBirth,
      gender: info.gender?.trim() || prev.gender,
      address: info.address?.trim() || prev.address,
      initialHospitalCode:
        info.initialHospitalCode?.trim() ||
        info.hospital?.trim() ||
        prev.initialHospitalCode,
      // `phone` is intentionally absent from this spread-and-overwrite: the card
      // carries none, so the number the patient typed has to survive untouched.
      isOcrVerified: true,
    }));
  }, []);

  function resetBooking() {
    setStep(0);
    setSymptoms("");
    setDeptIdx(null);
    setTimeSlot(null);
    setFormData(EMPTY_FORM);
    setTicket(null);
  }

  function validateStep(): boolean {
    if (step === 0 && !symptoms.trim()) {
      toast.error("Vui lòng chia sẻ một chút về triệu chứng của bạn để chúng tôi hỗ trợ.");
      return false;
    }
    if (step === 1) {
      if (deptIdx === null) {
        toast.error("Vui lòng chọn một chuyên khoa.");
        return false;
      }
      if (!timeSlot) {
        toast.error("Vui lòng chọn khung giờ khám.");
        return false;
      }
    }
    if (step === 2) {
      if (!formData.fullName.trim()) {
        toast.error("Vui lòng cung cấp họ và tên đầy đủ.");
        return false;
      }
      if (!formData.phone.trim() || formData.phone.trim().length < 8) {
        toast.error("Vui lòng cung cấp số điện thoại hợp lệ.");
        return false;
      }
    }
    return true;
  }

  function handleNext() {
    if (!validateStep()) return;

    if (step === 2) {
      const service: Service =
        deptIdx !== null ? CLINIC_SERVICES[deptIdx] : CLINIC_SERVICES[0];
      const doctor = resolveDoctorForService(service.title);
      const confirmed: ActiveAppointment = {
        ticketCode: "#APT-2026-8821",
        patientName: formData.fullName.trim().toUpperCase(),
        department: doctor.department,
        doctor: doctor.name,
        room: doctor.roomNumber,
        date: "Hôm nay",
        timeSlot: timeSlot ?? "08:30",
      };
      // The dashboard reads this back: without it the patient would land on
      // "Bạn chưa có lịch hẹn khám nào" right after booking.
      writeActiveBooking(confirmed);
      setTicket(confirmed);
      return;
    }
    setStep((s) => s + 1);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleNext();
  }

  return (
    <div className="min-h-screen bg-surface-light">
      <PatientNavbar />

      <main className="py-10 lg:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-card">
              <Calendar className="h-4 w-4 text-clinical-600" />
              Không cần thanh toán trước &middot; Tiếp nhận cả bệnh nhân vãng lai
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Đặt lịch khám
            </h1>
            <p className="mt-2 text-base leading-relaxed text-slate-500">
              Ba bước nhanh chóng và bạn xong - chúng tôi sẽ xác nhận qua tin
              nhắn SMS.
            </p>
          </div>

          {/* Step indicator */}
          <ol className="mt-8 flex items-center">
            {STEP_LABELS.map((label, index) => {
              const done = index < step;
              const active = index === step;
              return (
                <li key={label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-300 ${
                        done
                          ? "border-clinical-600 bg-clinical-600 text-white"
                          : active
                            ? "border-clinical-600 text-clinical-700"
                            : "border-slate-200 bg-white text-slate-400"
                      }`}
                    >
                      {done ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        active ? "text-slate-900" : "text-slate-500"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {index < STEP_LABELS.length - 1 && (
                    <span className="mx-2 mb-5 h-px flex-1 bg-slate-200 sm:mx-4" />
                  )}
                </li>
              );
            })}
          </ol>

          {/* Step card */}
          <div className="mt-8 rounded-xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8">
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {step === 0 && (
                <SymptomsStep
                  symptoms={symptoms}
                  onChange={setSymptoms}
                  onContinue={handleNext}
                  onOcrExtracted={handleOcrExtracted}
                  identity={formData}
                  onIdentityChange={setFormField}
                />
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <p className="mb-3 text-base font-medium text-slate-900">
                      Chọn chuyên khoa
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {CLINIC_SERVICES.map((service, index) => (
                        <button
                          key={service.title}
                          type="button"
                          onClick={() => setDeptIdx(index)}
                          aria-pressed={deptIdx === index}
                          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-base transition-colors ${
                            deptIdx === index
                              ? "border-clinical-600 bg-clinical-50 text-clinical-700"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {service.title}
                          {index === suggestedIdx && (
                            <span className="ml-auto shrink-0 rounded-full bg-triage-p3-bg px-2 py-0.5 text-xs font-semibold text-triage-p3">
                              Đề xuất
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-base font-medium text-slate-900">
                      Chọn khung giờ khám hôm nay
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {TIME_SLOTS.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setTimeSlot(slot)}
                          aria-pressed={timeSlot === slot}
                          className={`inline-flex h-10 items-center rounded-lg border px-4 text-base font-medium transition-colors ${
                            timeSlot === slot
                              ? "border-clinical-600 bg-clinical-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  {formData.isOcrVerified && (
                    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                      <p className="text-sm font-semibold text-teal-800">
                        BHYT Đã xác thực - thông tin đã được tự động điền từ thẻ
                        BHYT
                      </p>
                      <dl className="mt-2 space-y-1 text-sm text-slate-600">
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">Mã thẻ BHYT</dt>
                          <dd className="font-mono font-medium text-slate-800">
                            {formData.insuranceCode}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">Ngày sinh</dt>
                          <dd className="font-medium text-slate-800">
                            {formData.dateOfBirth}
                          </dd>
                        </div>
                        {formData.gender && (
                          <div className="flex justify-between gap-3">
                            <dt className="text-slate-500">Giới tính</dt>
                            <dd className="font-medium text-slate-800">
                              {formData.gender}
                            </dd>
                          </div>
                        )}
                        {formData.address && (
                          <div className="flex justify-between gap-3">
                            <dt className="shrink-0 text-slate-500">Địa chỉ</dt>
                            <dd className="text-right font-medium text-slate-800">
                              {formData.address}
                            </dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-3">
                          <dt className="text-slate-500">Nơi KCB ban đầu</dt>
                          <dd className="text-right font-medium text-slate-800">
                            {formData.initialHospitalCode}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  {/* Same fields as step 1, on the same state: the scan landed
                      them up there, and this is where the patient checks them
                      before the appointment is written down. */}
                  <BookingIdentityFields
                    value={formData}
                    onChange={setFormField}
                    idPrefix="booking-step3"
                  />

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      Tóm tắt lịch hẹn
                    </p>
                    <dl className="mt-2 space-y-1.5 text-base text-slate-600">
                      <div className="flex justify-between">
                        <dt>Chuyên khoa</dt>
                        <dd className="font-medium text-slate-900">
                          {deptIdx !== null
                            ? CLINIC_SERVICES[deptIdx].title
                            : "Khám Nội Tổng quát & Tầm soát"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Khung giờ</dt>
                        <dd className="font-medium text-slate-900">
                          {timeSlot}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Thanh toán trước</dt>
                        <dd className="font-medium text-slate-900">Không</dd>
                      </div>
                    </dl>
                  </div>

                  <p className="inline-flex items-center gap-2 text-base font-medium text-slate-600">
                    <PhoneCall className="h-5 w-5 text-clinical-600" />
                    Cần hỗ trợ? Gọi tổng đài (028) 1900 123 456
                  </p>
                </div>
              )}

              {/* Navigation */}
              {step > 0 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-5 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Quay lại
                  </button>

                  <button
                    type="submit"
                    className={`inline-flex h-11 items-center justify-center rounded-lg px-6 text-base font-semibold text-white shadow-card transition-all hover:shadow-elevated ${
                      step === 2
                        ? "bg-cta hover:bg-cta-hover"
                        : "bg-clinical-600 hover:bg-clinical-700"
                    }`}
                  >
                    {step === 2 ? "Xác nhận lịch hẹn" : "Tiếp tục"}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </main>

      <PatientFooter />
      <FloatingRagChatbot />

      {ticket && (
        <BookingTicketModal
          appointment={ticket}
          onClose={resetBooking}
        />
      )}
    </div>
  );
}