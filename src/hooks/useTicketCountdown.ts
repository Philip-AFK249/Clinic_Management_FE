import { useEffect, useMemo, useRef, useState } from "react";
import {
  TEMPORARY_HOLD_SECONDS,
  resolveHoldDeadline,
} from "../pages/patient/data/ticketLifecycle";

export interface TicketCountdown {
  /** Whole seconds before the hold ends, clamped at zero. */
  secondsLeft: number;
  /** Absolute timestamp, or `null` when neither field can be parsed. */
  deadlineMs: number | null;
  /** True as soon as the hold reaches 00:00 (or is already past). */
  expired: boolean;
  hasDeadline: boolean;
}

/**
 * One-second countdown driven by an absolute deadline, not by counting ticks.
 * A reload therefore shows the remaining time, never a restarted 03:00.
 *
 * `onExpire` is invoked from the interval callback (never from the effect body)
 * exactly once for a given deadline, so callers can purge a hold at 00:00
 * without adding another state-setting effect.
 */
export function useTicketCountdown(
  expiresAt: string | null | undefined,
  bookedAt: string | null | undefined,
  enabled = true,
  onExpire?: () => void,
): TicketCountdown {
  const deadlineMs = useMemo(
    () => resolveHoldDeadline(expiresAt, bookedAt),
    [expiresAt, bookedAt],
  );
  const [now, setNow] = useState(() => Date.now());
  const onExpireRef = useRef(onExpire);
  const expiredNotifiedRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expiredNotifiedRef.current = false;
    // A new deadline (or a re-enabled timer) must repaint immediately rather
    // than waiting for the next one-second tick.
    queueMicrotask(() => setNow(Date.now()));
  }, [deadlineMs, enabled]);

  useEffect(() => {
    if (!enabled || deadlineMs === null) return undefined;
    const handle = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadlineMs && !expiredNotifiedRef.current) {
        expiredNotifiedRef.current = true;
        onExpireRef.current?.();
      }
    }, 1000);
    return () => window.clearInterval(handle);
  }, [deadlineMs, enabled]);

  const secondsLeft =
    deadlineMs === null
      ? TEMPORARY_HOLD_SECONDS
      : Math.max(0, Math.ceil((deadlineMs - now) / 1000));

  return {
    secondsLeft,
    deadlineMs,
    expired: secondsLeft === 0,
    hasDeadline: deadlineMs !== null,
  };
}
