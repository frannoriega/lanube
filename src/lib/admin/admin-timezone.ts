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
export function enumerateDateKeysInclusive(
  fromKey: string,
  toKey: string,
): string[] {
  const out: string[] = [];
  let cur = fromKey;
  while (cur <= toKey) {
    out.push(cur);
    if (cur === toKey) break;
    cur = addDaysToDateKey(cur, 1);
  }
  return out;
}

/** Límites de un período, en ms: `[startMs, endMs]`, ambos inclusive. */
export interface PeriodBounds {
  startMs: number;
  endMs: number;
}

/**
 * Hoy, esta semana (domingo a sábado, como contaban las estadísticas) y este mes **en la hora del
 * predio**. Las estadísticas los calculaban con `setHours(0)`/`getDay()` sobre un `Date`, o sea
 * en la zona del servidor: en Vercel eso es UTC, y entre las 21:00 y las 24:00 de Argentina "hoy"
 * ya era mañana (milestone 25, C1). Cada período trae también su fin, para no sumar lo que viene
 * después (C2).
 */
export function currentPeriodsInAdminTz(nowMs: number): {
  day: PeriodBounds;
  week: PeriodBounds;
  month: PeriodBounds;
} {
  const today = dateKeyFromUnixMs(nowMs);
  const weekday = new TZDate(nowMs, ADMIN_TIMEZONE).getDay();
  const weekStart = addDaysToDateKey(today, -weekday);
  const monthStart = `${today.slice(0, 8)}01`;
  // Primer día del mes siguiente, menos uno: el último día de este mes.
  const [y, m] = today.split("-").map(Number);
  const nextMonth =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const monthEnd = addDaysToDateKey(nextMonth, -1);
  return {
    day: { startMs: startOfDateKeyMs(today), endMs: endOfDateKeyMs(today) },
    week: {
      startMs: startOfDateKeyMs(weekStart),
      endMs: endOfDateKeyMs(addDaysToDateKey(weekStart, 6)),
    },
    month: {
      startMs: startOfDateKeyMs(monthStart),
      endMs: endOfDateKeyMs(monthEnd),
    },
  };
}

/** First and last keys for the default forward window (inclusive). */
export function adminForwardWindowRange(
  dayCount: number,
  nowMs?: number,
): {
  fromKey: string;
  toKey: string;
} {
  const fromKey = todayDateKeyInAdminTz(nowMs);
  const toKey = addDaysToDateKey(fromKey, dayCount - 1);
  return { fromKey, toKey };
}
