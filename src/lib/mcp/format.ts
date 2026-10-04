import { TZDate } from "@date-fns/tz";
import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";

/**
 * Fechas de entrada y salida de las tools MCP (milestone 20). Puro y testeado.
 *
 * - **Entrada**: ISO 8601 **con offset obligatorio** (`2026-10-10T14:00:00-03:00` o `…Z`).
 *   Sin offset, "14:00" es ambiguo (¿hora del asistente, del usuario, del servidor?) y un
 *   error de zona horaria acá es una reserva a la hora equivocada: se rechaza con un mensaje
 *   que explica el formato, para que el asistente se corrija solo.
 * - **Salida**: ISO con el offset **del predio** (America/Argentina/Buenos_Aires) y además un
 *   texto `es-AR` legible ("viernes 10/10, 14:00–16:00"), coherente con la regla de fechas del
 *   proyecto (castellano, 24 h, zona del predio).
 */

const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export const ISO_FORMAT_HINT =
  "Usá ISO 8601 con offset, por ejemplo 2026-10-10T14:00:00-03:00 (hora de Argentina).";

/** Parsea un ISO con offset a ms; `null` si falta el offset o no es una fecha válida. */
export function parseIsoWithOffset(value: string): number | null {
  if (!ISO_WITH_OFFSET.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Fecha local del predio `YYYY-MM-DD` → ms de su medianoche local. `null` si es inválida. */
export function parseVenueDate(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new TZDate(y, mo - 1, d, 0, 0, 0, 0, ADMIN_TIMEZONE);
  // Rechaza fechas que "desbordan" (2026-02-31 → 3 de marzo).
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  )
    return null;
  return date.getTime();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** ms → ISO 8601 en la zona del predio, con su offset (`2026-10-10T14:00:00-03:00`). */
export function toVenueIso(ms: number): string {
  const d = new TZDate(ms, ADMIN_TIMEZONE);
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** ms → `YYYY-MM-DD` local del predio. */
export function toVenueDateKey(ms: number): string {
  return toVenueIso(ms).slice(0, 10);
}

const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: ADMIN_TIMEZONE,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: ADMIN_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * "viernes 10/10". Se arma desde las partes: el separador de `es-AR` para día/mes varía
 * entre versiones de ICU ("10/10" o "10-10").
 */
export function formatVenueDay(ms: number): string {
  const parts = dayFormatter.formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")} ${get("day")}/${get("month")}`;
}

/** "14:00" */
export function formatVenueTime(ms: number): string {
  return timeFormatter.format(ms);
}

/** "viernes 10/10, 14:00–16:00" (asume mismo día, que es lo único que se puede reservar). */
export function formatVenueRange(startMs: number, endMs: number): string {
  return `${formatVenueDay(startMs)}, ${formatVenueTime(startMs)}–${formatVenueTime(endMs)}`;
}
