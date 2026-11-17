import { TZDate } from "@date-fns/tz";
import { ADMIN_TIMEZONE, dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";

/**
 * Formatos compartidos por las salidas de la exportación de reportes. Todo en la hora del
 * predio (`ADMIN_TIMEZONE`), como el resto de los reportes: un archivo no tiene «zona del
 * navegador», y el reporte en pantalla ya cuenta los días en esa zona.
 */

/** Partes de reloj de pared de un instante en la hora del predio. */
export function wallClock(ms: number): {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
} {
  const t = new TZDate(ms, ADMIN_TIMEZONE);
  return {
    y: t.getFullYear(),
    m: t.getMonth() + 1,
    d: t.getDate(),
    h: t.getHours(),
    mi: t.getMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD HH:mm` en la hora del predio: el formato de fecha y hora de los CSV. */
export function isoDateTime(ms: number): string {
  const w = wallClock(ms);
  return `${w.y}-${pad(w.m)}-${pad(w.d)} ${pad(w.h)}:${pad(w.mi)}`;
}

/** `dd/mm/aaaa` a partir de `YYYY-MM-DD`. */
export function displayDateKey(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
}

/** `dd/mm/aaaa HH:mm` en la hora del predio. */
export function displayDateTime(ms: number): string {
  const w = wallClock(ms);
  return `${pad(w.d)}/${pad(w.m)}/${w.y} ${pad(w.h)}:${pad(w.mi)}`;
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Etiqueta corta de un período para nombres de hoja y de archivo: `2026-10` si es un mes
 * completo, `2026` si es un año completo, y si no `2026-10-01_2026-10-15`. Corta a propósito:
 * el nombre de una pestaña de Excel tiene como mucho 31 caracteres.
 */
export function periodTag(fromMs: number, toMs: number): string {
  const from = dateKeyFromUnixMs(fromMs);
  const to = dateKeyFromUnixMs(toMs);
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (fy === ty && fm === 1 && fd === 1 && tm === 12 && td === 31) {
    return String(fy);
  }
  if (fy === ty && fm === tm && fd === 1 && td === lastDayOfMonth(ty, tm)) {
    return `${fy}-${pad(fm)}`;
  }
  return `${from}_${to}`;
}

/** Caracteres que Excel no acepta en el nombre de una hoja. */
const SHEET_FORBIDDEN = /[[\]:*?/\\]/g;

/**
 * Nombre de pestaña válido y único dentro del libro: sin `[]:*?/\`, sin comillas simples en
 * los extremos, ≤ 31 caracteres y, si ya existe, con sufijo ` (2)`, ` (3)`… (que también entra
 * en los 31). `used` se actualiza.
 */
export function uniqueSheetName(base: string, used: Set<string>): string {
  const clean =
    base
      .replace(SHEET_FORBIDDEN, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^'+|'+$/g, "") || "Hoja";
  let name = clean.slice(0, 31).trim();
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n++})`;
    name = clean.slice(0, 31 - suffix.length).trim() + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}
