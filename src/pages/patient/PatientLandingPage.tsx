import PatientNavbar from "./components/PatientNavbar";
import HeroSection from "./components/HeroSection";
import RecentVisitsSection from "./components/RecentVisitsSection";
import TrustMetrics from "./components/TrustMetrics";
import ClinicalServices from "./components/ClinicalServices";
import MedicalStaffSection from "./components/MedicalStaffSection";
import AiWorkflowSteps from "./components/AiWorkflowSteps";
import ClinicLocations from "./components/ClinicLocations";
import ClinicFacility from "./components/ClinicFacility";
import ClinicalFaq from "./components/ClinicalFaq";
import PatientFooter from "./components/PatientFooter";
import MobileFloatingBar from "./components/MobileFloatingBar";
import FloatingRagChatbot from "./components/FloatingRagChatbot";

export default function PatientLandingPage() {
  return (
    <div className="min-h-screen bg-surface-light pb-24 text-slate-900 md:pb-0">
      <PatientNavbar />
      <main>
        <HeroSection />
        <RecentVisitsSection />
        <TrustMetrics />
        <ClinicalServices />
        <MedicalStaffSection />
        <AiWorkflowSteps />
        <ClinicLocations />
        <ClinicFacility />
        <ClinicalFaq />
      </main>
      <PatientFooter />
      <MobileFloatingBar />
      <FloatingRagChatbot />
    </div>
  );
}