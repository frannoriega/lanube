import { TZDate } from "@date-fns/tz";

/**
 * Admin-facing reservation dates use this IANA zone (matches es-AR UI).
 */
export const ADMIN_TIMEZONE = "America/Argentina/Buenos_Aires";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(s: string): boolean {
  return DATE_KEY_RE.test(s);
}

/** Calendar date (YYYY-MM-DD) containing this instant in the admin timezone. */
export function dateKeyFromUnixMs(ms: number): string {
  const d = new TZDate(ms, ADMIN_TIMEZONE);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Start of that calendar day in admin TZ, as Unix ms. */
export function startOfDateKeyMs(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const z = new TZDate(y, m - 1, d, 0, 0, 0, 0, ADMIN_TIMEZONE);
  return z.getTime();
}

/** End of that calendar day in admin TZ, as Unix ms. */
export function endOfDateKeyMs(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const z = new TZDate(y, m - 1, d, 23, 59, 59, 999, ADMIN_TIMEZONE);
  return z.getTime();
}

/** Today's YYYY-MM-DD in admin TZ. */
export function todayDateKeyInAdminTz(nowMs: number = Date.now()): string {
  return dateKeyFromUnixMs(nowMs);
}

/** Add signed calendar days to a date key in admin TZ. */
export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const z = new TZDate(y, m - 1, d, 12, 0, 0, 0, ADMIN_TIMEZONE);
  z.setDate(z.getDate() + deltaDays);
  const yy = z.getFullYear();
  const mm = String(z.getMonth() + 1).padStart(2, "0");
  const dd = String(z.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Inclusive list of date keys from `from` through `to` (lexicographic OK if same TZ calendar order). */
export function enumerateDateKeysInclusive(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let cur = fromKey;
  while (cur <= toKey) {
    out.push(cur);
    if (cur === toKey) break;
    cur = addDaysToDateKey(cur, 1);
  }
  return out;
}

/** First and last keys for the default forward window (inclusive). */
export function adminForwardWindowRange(dayCount: number, nowMs?: number): {
  fromKey: string;
  toKey: string;
} {
  const fromKey = todayDateKeyInAdminTz(nowMs);
  const toKey = addDaysToDateKey(fromKey, dayCount - 1);
  return { fromKey, toKey };
}

/** Monday (ISO) of the week containing `dateKey`, in admin TZ. */
export function startOfIsoWeekDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const z = new TZDate(y, m - 1, d, 12, 0, 0, 0, ADMIN_TIMEZONE);
  const dow = z.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  z.setDate(z.getDate() - daysFromMonday);
  const yy = z.getFullYear();
  const mm = String(z.getMonth() + 1).padStart(2, "0");
  const dd = String(z.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function endOfIsoWeekDateKey(weekStartKey: string): string {
  return addDaysToDateKey(weekStartKey, 6);
}

/** Current calendar week Monday through the following Sunday (14 days, admin TZ). */
export function adminTwoCalendarWeeksRange(nowMs?: number): {
  fromKey: string;
  toKey: string;
} {
  const today = todayDateKeyInAdminTz(nowMs);
  const mon = startOfIsoWeekDateKey(today);
  return { fromKey: mon, toKey: addDaysToDateKey(mon, 13) };
}
