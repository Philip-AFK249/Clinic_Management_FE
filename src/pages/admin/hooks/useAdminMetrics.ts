import { useState } from "react";
import type { OcrAuditLog } from "../data/adminMockData";
import { MOCK_SYSTEM_METRICS, MOCK_OCR_LOGS } from "../data/adminMockData";

export function useAdminMetrics() {
  const metrics = MOCK_SYSTEM_METRICS;
  const [ocrLogs] = useState<OcrAuditLog[]>(MOCK_OCR_LOGS);

  return { metrics, ocrLogs };
}
