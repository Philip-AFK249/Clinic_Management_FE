import { Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "./context/useAuth";
import AuthLayout from "./pages/auth/AuthLayout";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import PatientLandingPage from "./pages/patient/PatientLandingPage";
import BookingPage from "./pages/patient/BookingPage";
import PatientDashboardPage from "./pages/patient/PatientDashboardPage";
import DoctorEHRPage from "./pages/doctor/DoctorEHRPage";
import ReceptionDeskPage from "./pages/reception/ReceptionDeskPage";
import PharmacyPage from "./pages/pharmacy/PharmacyPage";
import KioskPage from "./pages/kiosk/KioskPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PatientLandingPage />} />
      <Route path="/patient/booking" element={<BookingPage />} />
      <Route path="/kiosk" element={<KioskPage />} />
      <Route path="/kios" element={<KioskPage />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route
        path="/patient/dashboard"
        element={
          <ProtectedRoute>
            <PatientDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/ehr"
        element={
          <ProtectedRoute>
            <DoctorEHRPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reception"
        element={
          <ProtectedRoute>
            <ReceptionDeskPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/queue"
        element={
          <ProtectedRoute>
            <PharmacyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/overview"
        element={
          <ProtectedRoute>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
