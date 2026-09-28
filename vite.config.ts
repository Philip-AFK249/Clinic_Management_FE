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
      // DoctorScheduleService (Spring Boot @ :8081) and everything else.
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
    },
  },
})
