import { useState, useCallback } from "react";
import type { DoctorShift } from "../data/adminMockData";
import { MOCK_DOCTOR_SHIFTS } from "../data/adminMockData";

export function useDoctorShifts() {
  const [shifts, setShifts] = useState<DoctorShift[]>(MOCK_DOCTOR_SHIFTS);

  const addShift = useCallback((shift: DoctorShift) => {
    setShifts((prev) => [...prev, shift]);
  }, []);

  const removeShift = useCallback((shiftId: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
  }, []);

  return { shifts, addShift, removeShift };
}