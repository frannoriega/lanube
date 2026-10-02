/**
 * Ventanas anuales "MM-DD" de los temas del landing (p. ej. "12-20" → "01-06", que cruza el
 * fin de año), y su traducción a fechas para el calendario del selector (milestone 16).
 *
 * Puro y seguro para el cliente; lo usan el selector de rango anual
 * (`AnnualRangePicker`), la lista de temas y la auditoría.
 */

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MONTH_DAY = /^(\d{2})-(\d{2})$/;

/** `"12-20"` → "20 de diciembre". Un valor mal formado se devuelve tal cual. */
export function formatMonthDay(value: string): string {
  const m = MONTH_DAY.exec(value);
  if (!m) return value;
  const month = MONTHS[Number(m[1]) - 1];
  return month ? `${Number(m[2])} de ${month}` : value;
}

/** Nombre del mes de una fecha ("diciembre"), para el encabezado del calendario sin año. */
export function monthName(date: Date): string {
  return MONTHS[date.getMonth()];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha local → `"MM-DD"`. */
export function dateToMonthDay(date: Date): string {
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `true` si la ventana cruza el fin de año (termina "antes" de empezar: 12-20 → 01-06). */
export function wrapsYear(start: string, end: string): boolean {
  return end < start;
}

/**
 * Años de referencia donde se dibuja una ventana anual en el calendario. El año no se guarda
 * — solo hace falta uno para poder mostrar un mes. Se eligen para que el 29 de febrero
 * exista donde puede aparecer: 2024 es bisiesto (ventanas dentro del año), y una ventana que
 * cruza el fin de año se dibuja de 2023 a 2024, así también puede terminar un 29-02.
 */
const REF_YEAR = 2024;

function toDate(md: string, year: number): Date | undefined {
  const m = MONTH_DAY.exec(md);
  if (!m) return undefined;
  return new Date(year, Number(m[1]) - 1, Number(m[2]));
}

/**
 * La ventana como fechas del calendario de referencia: `from`/`to` con el `to` en el año
 * siguiente cuando la ventana cruza el fin de año. Sin `start` no hay rango.
 */
export function annualRangeToDates(
  start: string,
  end: string,
): { from?: Date; to?: Date } {
  if (!MONTH_DAY.test(start)) return {};
  if (!MONTH_DAY.test(end)) return { from: toDate(start, REF_YEAR) };
  return wrapsYear(start, end)
    ? { from: toDate(start, REF_YEAR - 1), to: toDate(end, REF_YEAR) }
    : { from: toDate(start, REF_YEAR), to: toDate(end, REF_YEAR) };
}

/** Mes en que abre el calendario: el del inicio de la ventana, o enero de referencia. */
export function annualDefaultMonth(start: string, end: string): Date {
  return annualRangeToDates(start, end).from ?? new Date(REF_YEAR, 0, 1);
}

/** "20 de diciembre – 6 de enero (cada año)", o `null` si la ventana está incompleta. */
export function formatAnnualRange(start: string, end: string): string | null {
  if (!MONTH_DAY.test(start) || !MONTH_DAY.test(end)) return null;
  if (start === end) return `${formatMonthDay(start)} (cada año)`;
  return `${formatMonthDay(start)} – ${formatMonthDay(end)} (cada año)`;
}
