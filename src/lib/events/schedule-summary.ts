import type { EventOccurrence } from "@/lib/events/occurrences";

/**
 * Resumen legible del cronograma de un evento recurrente, para la página pública del evento
 * (milestone 18). En vez de obligar a leer una lista de trece fechas casi iguales, la página
 * abre con "Lunes y jueves · 10:00 – 13:00" + "Del 13 abr al 25 may 2026 · 13 sesiones".
 *
 * Es una función pura (sin `Date.now()` ni zona implícita) para poder testearla: la zona
 * horaria entra por parámetro. En el navegador se llama sin `timeZone`, o sea, en la zona del
 * visitante (principio de fechas del proyecto: el backend habla en UTC ms y la zona se resuelve
 * en el cliente). El idioma, en cambio, es siempre `es-AR`.
 */

const LOCALE = "es-AR";

const WEEKDAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/** Índice de día de semana (0 = domingo) de un instante, en la zona indicada. */
function weekdayIn(ms: number, timeZone?: string): number {
  const short = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone,
  }).format(new Date(ms));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

function timeIn(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(ms));
}

/** "a", "a y b", "a, b y c". */
export function joinSpanish(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export interface ScheduleSlot {
  /** Días (0 = domingo), ordenados de lunes a domingo. */
  weekdays: number[];
  /** "10:00". */
  start: string;
  /** "13:00". */
  end: string;
  /** "Lunes y jueves · 10:00 – 13:00". */
  label: string;
}

export interface ScheduleSummary {
  /** Un renglón por franja horaria distinta (casi siempre uno solo). */
  slots: ScheduleSlot[];
  /** Primera y última sesión que se dicta (sin contar las canceladas). */
  firstMs: number | null;
  lastMs: number | null;
  /** Sesiones que se dictan (no canceladas). */
  total: number;
  cancelled: number;
  /** "Del 13 abr al 25 may 2026" (o una sola fecha si empieza y termina el mismo día). */
  rangeLabel: string | null;
}

/** Lunes primero: la semana argentina arranca el lunes, el domingo va al final. */
const mondayFirst = (d: number) => (d + 6) % 7;

export function summarizeSchedule(
  occurrences: EventOccurrence[],
  timeZone?: string,
): ScheduleSummary {
  const held = occurrences.filter((o) => o.status !== "cancelled");
  const cancelled = occurrences.length - held.length;

  // Agrupa por franja horaria ("10:00–13:00") y junta los días de cada una. Una sesión
  // reprogramada a otro horario cuenta en su franja real, que es la que vale para el visitante.
  const byTime = new Map<
    string,
    { start: string; end: string; days: Set<number> }
  >();
  for (const o of held) {
    const start = timeIn(o.startMs, timeZone);
    const end = timeIn(o.endMs, timeZone);
    const key = `${start}-${end}`;
    const group = byTime.get(key) ?? { start, end, days: new Set<number>() };
    group.days.add(weekdayIn(o.startMs, timeZone));
    byTime.set(key, group);
  }

  const slots: ScheduleSlot[] = [...byTime.values()]
    .map(({ start, end, days }) => {
      const weekdays = [...days].sort(
        (a, b) => mondayFirst(a) - mondayFirst(b),
      );
      const names = joinSpanish(weekdays.map((d) => WEEKDAY_NAMES[d]));
      const label = `${names.charAt(0).toUpperCase()}${names.slice(1)} · ${start} – ${end}`;
      return { weekdays, start, end, label };
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  const times = held.map((o) => o.startMs).sort((a, b) => a - b);
  const firstMs = times[0] ?? null;
  const lastMs = times[times.length - 1] ?? null;

  return {
    slots,
    firstMs,
    lastMs,
    total: held.length,
    cancelled,
    rangeLabel:
      firstMs === null || lastMs === null
        ? null
        : rangeLabel(firstMs, lastMs, timeZone),
  };
}

function rangeLabel(
  firstMs: number,
  lastMs: number,
  timeZone?: string,
): string {
  // Se arma con las partes y no con `format()`: con año, es-AR intercala "de" ("13 de abr de
  // 2026"), demasiado largo para un renglón de resumen. Queda "13 abr 2026".
  const parts = (ms: number) => {
    const p = new Intl.DateTimeFormat(LOCALE, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone,
    }).formatToParts(new Date(ms));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      p.find((x) => x.type === type)?.value.replace(/\./g, "") ?? "";
    return { day: get("day"), month: get("month"), year: get("year") };
  };
  const fmt = (ms: number, withYear: boolean) => {
    const { day, month, year } = parts(ms);
    return withYear ? `${day} ${month} ${year}` : `${day} ${month}`;
  };
  const yearOf = (ms: number) => parts(ms).year;

  const last = fmt(lastMs, true);
  if (fmt(firstMs, true) === last) return `El ${last}`;
  // El año se repite sólo si cambia entre la primera y la última sesión.
  const first = fmt(firstMs, yearOf(firstMs) !== yearOf(lastMs));
  return `Del ${first} al ${last}`;
}
