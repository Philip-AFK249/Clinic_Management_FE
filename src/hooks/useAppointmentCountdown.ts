import { useEffect, useState } from "react";
import {
  HOLD_WINDOW_SECONDS,
  formatCountdown,
  parseDateMs,
  parseRemainingSeconds,
  secondsUntilDeadline,
  type HoldSource,
} from "../lib/appointmentHold";

interface AppointmentCountdownOptions extends HoldSource {
  /** Paused (and reset) once the ticket leaves PENDING_APPROVAL. */
  enabled: boolean;
}

export interface AppointmentCountdown {
  remainingSeconds: number;
  elapsedSeconds: number;
  /** `mm:ss` remaining, e.g. `02:59`. */
  label: string;
  /** `mm:ss` elapsed since the hold started. */
  elapsedLabel: string;
  /** 0-100, for a progress bar. */
  progressPercent: number;
  isExpired: boolean;
}

/**
 * Live three-minute countdown with a 1-second tick.
 *
 * The anchor is captured on the first render: `holdExpiresAt` wins, otherwise
 * the first `remainingSeconds` answer (or `checkInTime`, or the render time) is
 * used to derive an absolute deadline. Re-reading a changing `remainingSeconds`
 * on each poll would reset the clock and let a hold run forever; an absolute
 * deadline derived once cannot.
 */
export function useAppointmentCountdown({
  holdExpiresAt,
  remainingSeconds,
  checkInTime,
  enabled,
}: AppointmentCountdownOptions): AppointmentCountdown {
  const [now, setNow] = useState(() => Date.now());
  const [firstSeenAt] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [enabled]);

  const explicit = parseDateMs(holdExpiresAt);
  const checkIn = parseDateMs(checkInTime);
  const snapshot = parseRemainingSeconds(remainingSeconds);
  const deadline =
    explicit ??
    (checkIn !== null
      ? checkIn + HOLD_WINDOW_SECONDS * 1000
      : firstSeenAt + (snapshot ?? HOLD_WINDOW_SECONDS) * 1000);

  const remaining = secondsUntilDeadline(deadline, now);
  const elapsed = HOLD_WINDOW_SECONDS - remaining;

  return {
    remainingSeconds: remaining,
    elapsedSeconds: elapsed,
    label: formatCountdown(remaining),
    elapsedLabel: formatCountdown(elapsed),
    progressPercent: Math.round((elapsed / HOLD_WINDOW_SECONDS) * 100),
    isExpired: remaining <= 0,
  };
}
