import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // PatientIntakeService (Spring Boot @ :8082).
      // These two prefixes MUST stay declared above the catch-all '/api' rule:
      // Vite matches proxy contexts in declaration order and takes the first hit.
      '/api/v1/intake': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      '/api/v1/queue': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
      },
      // ClinicalConsultationService (Spring Boot @ :8083): bệnh án của bác sĩ và
      // hàng đợi cấp phát của dược sĩ. Same ordering rule as above - these two
      // prefixes must stay ahead of the '/api' catch-all.
      '/api/v1/clinical': {
        target: 'http://127.0.0.1:8083',
        changeOrigin: true,
      },
      '/api/v1/pharmacy': {
        target: 'http://127.0.0.1:8083',
        changeOrigin: true,
      },
      // DoctorScheduleService (Spring Boot @ :8081) and everything else.
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
    },
  },
})
