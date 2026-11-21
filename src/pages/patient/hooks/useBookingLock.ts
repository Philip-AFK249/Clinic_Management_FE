import { useCallback, useEffect, useState } from "react";
import { getBookingLockStatusApi } from "../../../services/intakeApi";
import type { BookingLockStatusDto } from "../../../services/intakeApi";
import { secondsUntil } from "../data/ticketLifecycle";

/** The clinic's re-booking cooldown after a rejected online ticket. */
export const BOOKING_LOCK_SECONDS = 180;
export const BOOKING_LOCK_MS = BOOKING_LOCK_SECONDS * 1000;

const LOCK_STORAGE_PREFIX = "patient_booking_lock";
const LEGACY_LOCK_KEYS = ["clinic_booking_lock"];

function lockKey(ownerEmail: string | null | undefined): string | null {
  const email = ownerEmail?.trim().toLowerCase();
  return email ? `${LOCK_STORAGE_PREFIX}_${email}` : null;
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value || typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function isLockStatus(value: unknown): value is BookingLockStatusDto {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.isLocked === "boolean" &&
    (source.lockedUntil === null || typeof source.lockedUntil === "string") &&
    typeof source.remainingSeconds === "number" &&
    (source.reason === null || typeof source.reason === "string")
  );
}

function sweepLegacyLocks(): void {
  for (const key of LEGACY_LOCK_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Best-effort hygiene only.
    }
  }
}

/** The locally mirrored lock for one account, or `null`. */
export function readLocalBookingLock(
  ownerEmail: string | null | undefined,
): BookingLockStatusDto | null {
  try {
    sweepLegacyLocks();
    const key = lockKey(ownerEmail);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isLockStatus(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Persist the cooldown locally. The queue service owns the authoritative lock;
 * this copy only keeps the banner accurate while the service is unreachable.
 */
export function writeLocalBookingLock(
  ownerEmail: string | null | undefined,
  reason: string | null | undefined,
  lockedUntilMs: number = Date.now() + BOOKING_LOCK_MS,
): BookingLockStatusDto {
  const status: BookingLockStatusDto = {
    isLocked: true,
    lockedUntil: new Date(lockedUntilMs).toISOString(),
    remainingSeconds: BOOKING_LOCK_SECONDS,
    reason: reason?.trim() ? reason.trim() : null,
  };
  try {
    const key = lockKey(ownerEmail);
    if (key) localStorage.setItem(key, JSON.stringify(status));
  } catch {
    // A blocked storage costs nothing: the server answer still gates booking.
  }
  return status;
}

export function clearLocalBookingLock(ownerEmail?: string | null): void {
  try {
    const key = lockKey(ownerEmail);
    if (key) localStorage.removeItem(key);
    sweepLegacyLocks();
  } catch {
    // Nothing to do.
  }
}

export interface BookingLockParams {
  patientId?: number | null;
  identifiers?: string[];
  ownerEmail?: string | null;
}

export interface BookingLockState {
  isLocked: boolean;
  remainingSeconds: number;
  lockedUntil: string | null;
  reason: string | null;
  isChecking: boolean;
  /** Called when this browser learns about a fresh rejection. */
  activateLock: (reason?: string | null, lockedUntilMs?: number) => void;
  /** Re-ask the queue service; the local copy stays in place meanwhile. */
  refresh: () => void;
}

interface LockSnapshot {
  key: string;
  status: BookingLockStatusDto | null;
}

/**
 * Booking cooldown shared by the booking form and the patient dashboard.
 *
 * The server lock is checked on mount and after every local activation; a
 * timestamp stored under this account's email is the fallback when the queue
 * service cannot answer. The visible countdown is derived from the absolute
 * `lockedUntil`, so a reload never restarts the three minutes.
 */
export function useBookingLock(params: BookingLockParams): BookingLockState {
  const ownerEmail = params.ownerEmail ?? null;
  const patientId = params.patientId ?? null;
  const identifiers = (params.identifiers ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
  const identifierKey = identifiers.join("|");
  const key = `${patientId ?? ""}|${identifierKey}|${ownerEmail ?? ""}`;

  const [now, setNow] = useState(() => Date.now());
  const [localSnapshot, setLocalSnapshot] = useState<{
    owner: string | null;
    status: BookingLockStatusDto | null;
  }>(() => ({ owner: ownerEmail, status: readLocalBookingLock(ownerEmail) }));
  const [serverSnapshot, setServerSnapshot] = useState<LockSnapshot>({
    key: "",
    status: null,
  });
  const [isChecking, setIsChecking] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, []);

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (patientId === null && identifierKey === "") return;
      setIsChecking(true);
      try {
        let latest: BookingLockStatusDto | null = null;
        const candidates: { patientId?: number; identifier?: string }[] = [];
        if (patientId !== null) candidates.push({ patientId });
        for (const identifier of identifierKey.split("|")) {
          candidates.push({ identifier });
        }
        for (const candidate of candidates) {
          const answer = await getBookingLockStatusApi(candidate, signal);
          if (signal.aborted) return;
          latest = answer;
          const deadline = parseTimestamp(answer.lockedUntil);
          if (answer.isLocked && deadline !== null && deadline > Date.now()) break;
        }
        setServerSnapshot({ key, status: latest });
      } catch {
        if (!signal.aborted) setServerSnapshot({ key, status: null });
      } finally {
        if (!signal.aborted) setIsChecking(false);
      }
    },
    [identifierKey, key, patientId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal));
    return () => controller.abort();
  }, [load, reloadToken]);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const activateLock = useCallback(
    (reason?: string | null, lockedUntilMs?: number) => {
      const status = writeLocalBookingLock(ownerEmail, reason, lockedUntilMs);
      setLocalSnapshot({ owner: ownerEmail, status });
      setNow(Date.now());
      refresh();
    },
    [ownerEmail, refresh],
  );

  const localStatus =
    localSnapshot.owner === ownerEmail
      ? localSnapshot.status
      : readLocalBookingLock(ownerEmail);
  const serverStatus = serverSnapshot.key === key ? serverSnapshot.status : null;

  const activeLock = [serverStatus, localStatus]
    .filter((status): status is BookingLockStatusDto => {
      if (!status?.isLocked) return false;
      const deadline = parseTimestamp(status.lockedUntil);
      return deadline !== null && deadline > now;
    })
    .sort((left, right) => {
      const leftMs = parseTimestamp(left.lockedUntil) ?? 0;
      const rightMs = parseTimestamp(right.lockedUntil) ?? 0;
      return rightMs - leftMs;
    })[0] ?? null;

  const remainingSeconds = activeLock
    ? secondsUntil(parseTimestamp(activeLock.lockedUntil))
    : 0;

  return {
    isLocked: remainingSeconds > 0,
    remainingSeconds,
    lockedUntil: activeLock?.lockedUntil ?? null,
    reason: activeLock?.reason ?? null,
    isChecking,
    activateLock,
    refresh,
  };
}
