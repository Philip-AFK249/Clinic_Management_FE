import { MOCK_SYSTEM_METRICS } from "../data/adminMockData";

export function useAdminMetrics() {
  const metrics = MOCK_SYSTEM_METRICS;

  return { metrics };
}
