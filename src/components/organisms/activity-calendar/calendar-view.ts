/**
 * Lógica pura del calendario de actividades (milestone 32): qué días muestra cada vista, cómo
 * se navega, cómo se reparten en columnas los ítems que se superponen y qué franja horaria
 * dibujar. Sin React; testeada en `calendar-view.test.ts`.
 *
 * Las fechas son `Date` en la zona del **navegador** (como el calendario de reservas): el
 * servidor manda instantes en ms y acá se ubican en el reloj de quien mira.
 */
import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  format,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

export type CalendarView = "day" | "3days" | "week" | "month";

export const CALENDAR_VIEWS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "3days", label: "3 días" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

export function isCalendarView(v: unknown): v is CalendarView {
  return CALENDAR_VIEWS.some((x) => x.value === v);
}

/**
 * Vista por defecto según el ancho (si la persona no eligió una antes): como el calendario de
 * reservas, en un teléfono un día, en una tablet chica 3 días, y la semana desde 768 px.
 */
export function defaultViewFor(opts: {
  isSm: boolean;
  isMd: boolean;
}): CalendarView {
  if (opts.isMd) return "week";
  if (opts.isSm) return "3days";
  return "day";
}

/** Los días que muestra la vista. El mes es la grilla completa de 6 semanas (lunes a domingo). */
export function viewDays(view: CalendarView, anchor: Date): Date[] {
  const a = startOfDay(anchor);
  switch (view) {
    case "day":
      return [a];
    case "3days":
      return [a, addDays(a, 1), addDays(a, 2)];
    case "week": {
      const monday = startOfWeek(a, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    }
    case "month": {
      const first = startOfWeek(startOfMonth(a), { weekStartsOn: 1 });
      return Array.from({ length: 42 }, (_, i) => addDays(first, i));
    }
  }
}

/** Mueve el ancla una página hacia atrás (-1) o adelante (+1). */
export function shiftAnchor(
  view: CalendarView,
  anchor: Date,
  dir: -1 | 1,
): Date {
  switch (view) {
    case "day":
      return addDays(anchor, dir);
    case "3days":
      return addDays(anchor, 3 * dir);
    case "week":
      return addWeeks(anchor, dir);
    case "month":
      return addMonths(startOfMonth(anchor), dir);
  }
}

/** Rango `[desde, hasta]` en ms que hay que pedir para la vista. */
export function viewRange(days: Date[]): { from: number; to: number } {
  return {
    from: startOfDay(days[0]).getTime(),
    to: endOfDay(days[days.length - 1]).getTime(),
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Título de la barra: «noviembre de 2026», «17 – 23 de noviembre de 2026», «martes 17 de noviembre». */
export function viewTitle(
  view: CalendarView,
  days: Date[],
  anchor: Date,
): string {
  if (view === "month") {
    return cap(format(anchor, "MMMM 'de' yyyy", { locale: es }));
  }
  if (view === "day") {
    return cap(format(days[0], "EEEE d 'de' MMMM 'de' yyyy", { locale: es }));
  }
  const first = days[0];
  const last = days[days.length - 1];
  if (isSameMonth(first, last)) {
    return `${format(first, "d")} – ${format(last, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
  }
  return `${format(first, "d 'de' MMM", { locale: es })} – ${format(last, "d 'de' MMM 'de' yyyy", { locale: es })}`;
}

export interface Timed {
  id: string;
  startMs: number;
  endMs: number;
}

/** Los ítems que tocan el día (local) `day`, recortados no: se devuelven tal cual. */
export function itemsOnDay<T extends Timed>(
  items: readonly T[],
  day: Date,
): T[] {
  const from = startOfDay(day).getTime();
  const to = endOfDay(day).getTime();
  return items.filter((i) => i.startMs <= to && i.endMs > from);
}

/**
 * Reparte los ítems de un día en columnas («carriles») para que los que se superponen se vean
 * lado a lado: cada grupo de ítems encadenados por superposición comparte un número de
 * carriles, y cada ítem toma el primero libre. Devuelve, por id, el carril y cuántos hay en su
 * grupo (el ancho de cada uno es 1 / lanes).
 */
export function layoutLanes(
  items: readonly Timed[],
): Map<string, { lane: number; lanes: number }> {
  const sorted = [...items].sort(
    (a, b) => a.startMs - b.startMs || b.endMs - a.endMs,
  );
  const out = new Map<string, { lane: number; lanes: number }>();
  let group: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;
  const closeGroup = () => {
    for (const g of group) {
      out.set(g.id, { lane: g.lane, lanes: laneEnds.length });
    }
    group = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    if (it.startMs >= groupEnd) {
      closeGroup();
      groupEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((end) => end <= it.startMs);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.endMs);
    } else {
      laneEnds[lane] = it.endMs;
    }
    group.push({ id: it.id, lane });
    groupEnd = Math.max(groupEnd, it.endMs);
  }
  closeGroup();
  return out;
}

/**
 * Franja horaria a dibujar: el horario de reserva (8 a 19) ampliado para que entre todo lo de
 * la vista (un evento a las 20 h no se corta). Horas enteras dentro de [0, 24].
 */
export function hourBounds(
  items: readonly Timed[],
  defaults: { start: number; end: number } = { start: 8, end: 19 },
): { start: number; end: number } {
  let start = defaults.start;
  let end = defaults.end;
  for (const i of items) {
    const s = new Date(i.startMs);
    const e = new Date(i.endMs);
    const sameDay = startOfDay(s).getTime() === startOfDay(e).getTime();
    start = Math.min(start, s.getHours());
    const endHour = sameDay ? e.getHours() + (e.getMinutes() > 0 ? 1 : 0) : 24;
    end = Math.max(end, endHour);
  }
  return { start: Math.max(0, start), end: Math.min(24, end) };
}

/** Posición vertical de un ítem en un día, en % de la franja `[start, end)` horas. */
export function verticalPosition(
  item: Timed,
  day: Date,
  bounds: { start: number; end: number },
): { top: number; height: number } {
  const dayStart = startOfDay(day).getTime();
  const from = dayStart + bounds.start * 3_600_000;
  const to = dayStart + bounds.end * 3_600_000;
  const s = Math.max(item.startMs, from);
  const e = Math.min(item.endMs, to);
  const span = to - from;
  return {
    top: ((s - from) / span) * 100,
    height: Math.max(0, ((e - s) / span) * 100),
  };
}
