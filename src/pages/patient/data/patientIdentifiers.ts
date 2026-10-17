import type { User } from "../../../types/auth";

/**
 * The patient identifiers PatientIntakeService can match a record by, and the
 * variants of them worth sending.
 *
 * `GET /v1/queue/patient/active?identifier=...` compares the value against the
 * intake record's phone, CCCD and BHYT columns with exact equality, so a
 * number that differs only in spacing ("DN 4 79 79 12345678" vs
 * "DN4797912345678") or country-code style ("+84..." vs "0...") silently finds
 * nothing - which is exactly how a patient who booked a future visit ends up
 * on an empty dashboard after re-login. Every plausible spelling of each field
 * is therefore produced here, in the order the dashboard should prefer them,
 * and the caller tries them in turn.
 */

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function pushVariants(target: string[], ...values: string[]): void {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) target.push(trimmed);
  }
}

/** Phone: as typed, digits only, and the 84/0 country-code spellings. */
function phoneVariants(phone: string): string[] {
  const out: string[] = [];
  const plain = digits(phone);
  pushVariants(out, phone, plain);
  if (plain.startsWith("84") && plain.length >= 11) {
    pushVariants(out, `0${plain.slice(2)}`);
  } else if (plain.startsWith("0") && plain.length >= 10) {
    pushVariants(out, `84${plain.slice(1)}`);
  }
  return out;
}

/** BHYT: as typed, compacted, and the grouped form the card prints. */
function insuranceVariants(code: string): string[] {
  const out: string[] = [];
  const compact = code.replace(/\s+/g, "").toUpperCase();
  const grouped = compact.replace(
    /^([A-Z]{2})(\d)(\d{2})(\d{2})(\d{8})$/,
    "$1 $2 $3 $4 $5",
  );
  pushVariants(out, code, compact, grouped);
  return out;
}

/** CCCD/CMND: as typed and digits only. */
function identityVariants(id: string): string[] {
  const out: string[] = [];
  pushVariants(out, id, digits(id));
  return out;
}

/**
 * Ordered, de-duplicated candidates for the active-ticket lookup: phone first
 * (what a check-in records and what the session is most likely to hold), then
 * the BHYT number, then the CCCD - each in its plausible spellings.
 *
 * `extras` carries anything else that should be tried, e.g. the phone recorded
 * on a booking made for a relative under this account.
 */
export function identifierCandidates(
  user: Pick<User, "phone" | "identityCardNumber" | "insuranceCode"> | null | undefined,
  extras: (string | null | undefined)[] = [],
): string[] {
  const out: string[] = [];
  if (user) {
    if (user.phone) out.push(...phoneVariants(user.phone));
    if (user.insuranceCode) out.push(...insuranceVariants(user.insuranceCode));
    if (user.identityCardNumber) out.push(...identityVariants(user.identityCardNumber));
  }
  for (const extra of extras) {
    if (extra) out.push(...phoneVariants(extra));
  }
  return [...new Set(out.map((value) => value.trim()).filter(Boolean))];
}
