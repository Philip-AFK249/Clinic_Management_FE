import {
  getEncountersByTicketNumbersApi,
  getPatientEncountersApi,
} from "../../../services/clinicalApi";
import type { PatientEncounterDto } from "../../../services/clinicalApi";
import { getPatientBookingHistoryApi } from "../../../services/intakeApi";

export interface PatientEncounterQuery {
  /**
   * AuthService's `users.id`. It is also tried as an intake patient id because
   * the two services can share the same numeric key for a patient created at
   * check-in; `PatientIntakeService` answers empty when they do not.
   */
  userId?: number | null;
  /** Phone / CCCD / BHYT spellings from `identifierCandidates`. */
  identifiers?: string[];
  /** Patient ids already known from the active ticket or cached booking. */
  patientIds?: (number | null | undefined)[];
  /** Ticket numbers already known from the active ticket or cached booking. */
  ticketNumbers?: (string | null | undefined)[];
}

export interface PatientEncounterLoadResult {
  encounters: PatientEncounterDto[];
  /** True when at least one clinical source answered, even with no rows. */
  answered: boolean;
}

export function encounterKey(encounter: PatientEncounterDto): string {
  if (
    typeof encounter.encounterId === "number" &&
    Number.isFinite(encounter.encounterId) &&
    encounter.encounterId > 0
  ) {
    return `encounter-${encounter.encounterId}`;
  }
  return `ticket-${encounter.ticketNumber}-${encounter.encounterDate}`;
}

export function encounterTimestamp(encounter: PatientEncounterDto): number {
  const parsed = Date.parse(encounter.encounterDate || encounter.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Client-only ticket minted by the old "Khám lại" flow, never from intake. */
const SYNTHETIC_TICKET_PREFIX = "#TK-RE-";

/** `YYYY-MM-DD` bucket used to compare a synthetic row with a real visit. */
function encounterDateKey(encounter: PatientEncounterDto): string {
  const raw = encounter.encounterDate || encounter.createdAt || "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : raw.slice(0, 10);
}

function isSyntheticTicket(ticketNumber: string | undefined): boolean {
  return Boolean(ticketNumber?.startsWith(SYNTHETIC_TICKET_PREFIX));
}

/**
 * Merge the lookups into one timeline. The same encounter can arrive from both
 * a patient id and a ticket number, and the later copy wins field by field so
 * the richer payload (prescription lines, billing) is preserved.
 *
 * Cancelled encounters are dropped entirely. Client-only `#TK-RE-...` rows are
 * also dropped once a real completed encounter exists on the same date, so a
 * stale synthetic "Đang khám" row cannot shadow the visit the patient actually
 * finished.
 */
export function mergeEncounters(
  list: PatientEncounterDto[],
): PatientEncounterDto[] {
  const active = list.filter((encounter) => encounter.status !== "CANCELLED");

  const completedDates = new Set(
    active
      .filter(
        (encounter) =>
          encounter.status === "COMPLETED" &&
          !isSyntheticTicket(encounter.ticketNumber),
      )
      .map(encounterDateKey),
  );

  const byKey = new Map<string, PatientEncounterDto>();
  for (const encounter of active) {
    if (
      isSyntheticTicket(encounter.ticketNumber) &&
      completedDates.has(encounterDateKey(encounter))
    ) {
      continue;
    }
    const key = encounterKey(encounter);
    const existing = byKey.get(key);
    byKey.set(key, existing ? { ...existing, ...encounter } : encounter);
  }
  return [...byKey.values()].sort(
    (left, right) => encounterTimestamp(right) - encounterTimestamp(left),
  );
}

/**
 * Resolve a patient's encounter timeline without assuming AuthService's user id
 * maps onto PatientIntakeService's patient id.
 *
 * Intake history is read first by every identifier spelling and by the known
 * patient ids; the ticket numbers / patient ids found there then drive the
 * clinical lookups, which run in parallel. A failing source degrades to an
 * empty list rather than blanking the whole timeline.
 */
export async function loadPatientEncounters(
  query: PatientEncounterQuery,
  signal?: AbortSignal,
): Promise<PatientEncounterLoadResult> {
  const identifiers = query.identifiers ?? [];
  const knownPatientIds = new Set<number>();
  if (typeof query.userId === "number") knownPatientIds.add(query.userId);
  for (const patientId of query.patientIds ?? []) {
    if (typeof patientId === "number") knownPatientIds.add(patientId);
  }

  const ticketNumbers = new Set<string>();
  for (const ticketNumber of query.ticketNumbers ?? []) {
    if (ticketNumber?.trim()) ticketNumbers.add(ticketNumber.trim());
  }

  const [historyByIdentifier, historyByPatientId] = await Promise.all([
    Promise.all(
      identifiers.map((identifier) =>
        getPatientBookingHistoryApi(undefined, identifier, signal).catch(
          () => [],
        ),
      ),
    ),
    Promise.all(
      [...knownPatientIds].map((patientId) =>
        getPatientBookingHistoryApi(patientId, undefined, signal).catch(
          () => [],
        ),
      ),
    ),
  ]);
  if (signal?.aborted) return { encounters: [], answered: false };

  for (const historyTicket of [
    ...historyByIdentifier.flat(),
    ...historyByPatientId.flat(),
  ]) {
    if (historyTicket?.ticketNumber) {
      ticketNumbers.add(historyTicket.ticketNumber);
    }
    if (typeof historyTicket?.patientId === "number") {
      knownPatientIds.add(historyTicket.patientId);
    }
  }

  const [patientResults, ticketResult] = await Promise.all([
    Promise.all(
      [...knownPatientIds].map(async (patientId) => {
        try {
          return {
            ok: true as const,
            list: await getPatientEncountersApi(patientId, signal),
          };
        } catch {
          return { ok: false as const, list: [] as PatientEncounterDto[] };
        }
      }),
    ),
    ticketNumbers.size > 0
      ? getEncountersByTicketNumbersApi([...ticketNumbers], signal)
          .then((list) => ({ ok: true as const, list }))
          .catch(() => ({ ok: false as const, list: [] as PatientEncounterDto[] }))
      : Promise.resolve({
          ok: false as const,
          list: [] as PatientEncounterDto[],
        }),
  ]);
  if (signal?.aborted) return { encounters: [], answered: false };

  return {
    encounters: mergeEncounters([
      ...patientResults.flatMap((result) => result.list),
      ...ticketResult.list,
    ]),
    answered:
      patientResults.some((result) => result.ok) || ticketResult.ok,
  };
}
