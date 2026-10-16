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
      // AiGatewayService (FastAPI): BHYT card OCR + the RAG chat.
      // Must stay ahead of the '/api' catch-all below, otherwise the scan would
      // be forwarded to DoctorScheduleService and 404.
      //
      // Same origin the gateway clients in `src/services` use: the service runs
      // as `uvicorn app.api:app --port 8008`, and `VITE_AI_GATEWAY_URL` can
      // point elsewhere (in which case the clients bypass this proxy entirely).
      '/api/v1/ocr': {
        target: 'http://127.0.0.1:8008',
        changeOrigin: true,
      },
      // Voice triage is deliberately NOT proxied: the client in
      // `services/voiceTriageApi.ts` goes to VITE_AI_GATEWAY_URL directly, and
      // the server has CORS open, so there is nothing for a rule to do here.
      // DoctorScheduleService (Spring Boot @ :8081) and everything else.
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
    },
  },
})
