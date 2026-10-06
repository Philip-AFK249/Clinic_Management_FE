import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // AuthService (Spring Boot @ :8085): JWT issue/verify + user directory.
      // Declared first because it is the most specific prefix; every rule below
      // must stay ahead of the '/api' catch-all (Vite matches in order).
      '/api/v1/auth': {
        target: 'http://127.0.0.1:8085',
        changeOrigin: true,
      },
      // PatientIntakeService (Spring Boot @ :8082).
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
      // AiGatewayService (FastAPI @ :8000): BHYT card OCR + the RAG chat.
      // Must stay ahead of the '/api' catch-all below, otherwise the scan would
      // be forwarded to DoctorScheduleService and 404.
      '/api/v1/ocr': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Same gateway, second controller: voice triage (Whisper + clinical LLM
      // + schedule lookup). Same ordering rule - ahead of the '/api' catch-all.
      '/api/v1/triage': {
        target: 'http://127.0.0.1:8000',
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
