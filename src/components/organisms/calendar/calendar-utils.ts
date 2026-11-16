/**
 * Constantes y funciones puras del calendario de reservas (`WeekCalendar` + `DayColumn` +
 * `DayStrip`). Viven acá —y no dentro del componente— para que las compartan las piezas
 * extraídas en el milestone 14 y para poder testearlas sin montar React
 * (`calendar-utils.test.ts`).
 */
import { bookingHorizonLastDateKey } from "@/lib/reservations/booking-horizon";
import {
  BOOKING_CLOSE_HOUR,
  BOOKING_OPEN_HOUR,
} from "@/lib/reservations/booking-window";
import {
  addDays,
  addWeeks,
  format,
  getDay,
  isSameDay,
  startOfWeek,
} from "date-fns";

/** Horario de atención: el eje vertical del calendario va de START a END. */
export const BUSINESS_HOURS = {
  START: BOOKING_OPEN_HOUR,
  END: BOOKING_CLOSE_HOUR,
} as const;

/** Granularidad de las reservas (y de los selects de hora), en minutos. */
export const TIME_INTERVAL_MINUTES = 15;

/** Último minuto del día en el que puede empezar un turno y todavía entrar uno mínimo antes del cierre. */
export const LAST_BOOKABLE_START_MINUTES =
  BUSINESS_HOURS.END * 60 - TIME_INTERVAL_MINUTES;

/** Cantidad de días hábiles de una semana del calendario (lunes a viernes). */
export const WORK_WEEK_DAYS = 5;

export function fromUtcMs(ms: number): Date {
  return new Date(ms);
}

/**
 * Un día queda bloqueado por completo cuando hasta su último turno posible ya empezó (p. ej.
 * hoy después de las 18:45). Sin anticipación mínima (milestone 26), solo puede pasarle a hoy
 * y a días pasados. Los turnos anteriores de un día todavía abierto se rechazan uno por uno
 * (arrastre, toque, envío) con la misma comparación contra el reloj.
 */
export function isDayFullyBlocked(day: Date, clock: Date): boolean {
  const lastSlot = new Date(day);
  lastSlot.setHours(0, LAST_BOOKABLE_START_MINUTES, 0, 0);
  return lastSlot.getTime() < clock.getTime();
}

/**
 * ¿`day` (medianoche local) cae después del último día reservable? (horizonte deslizante de
 * dos semanas, milestone 26: `reservations/booking-horizon.ts`). Esos días **no se dibujan**
 * —se acorta el calendario— en lugar de mostrarse rayados; los pasados, en cambio, sí se
 * muestran rayados (`isDayFullyBlocked`) para no perder la referencia de la semana.
 */
export function isDayBeyondHorizon(day: Date, clock: Date): boolean {
  // Se compara por fecha de calendario (`YYYY-MM-DD`) y no por instante: `day` es la medianoche
  // en la zona del navegador y el horizonte se calcula en la del predio; las fechas no dependen
  // de la diferencia entre ambas.
  return format(day, "yyyy-MM-dd") > bookingHorizonLastDateKey(clock.getTime());
}

/** Lunes de la semana que contiene el último día reservable: la última página del calendario. */
export function horizonWeekStart(clock: Date): Date {
  const [y, m, d] = bookingHorizonLastDateKey(clock.getTime())
    .split("-")
    .map(Number);
  return startOfWeek(new Date(y, m - 1, d), { weekStartsOn: 1 });
}

/**
 * Cuántos de los días de `weekDays` (lunes a viernes, en orden) están dentro del horizonte.
 * Los que quedan afuera son siempre un sufijo, así que alcanza con contar el prefijo.
 */
export function daysWithinHorizon(weekDays: Date[], clock: Date): number {
  return weekDays.filter((d) => !isDayBeyondHorizon(d, clock)).length;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

/** Opciones "HH:mm" cada 15 minutos dentro del horario de atención (inicio y fin incluidos). */
export function generateTimeOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  for (
    let minutes = BUSINESS_HOURS.START * 60;
    minutes <= BUSINESS_HOURS.END * 60;
    minutes += TIME_INTERVAL_MINUTES
  ) {
    const value = minutesToTime(minutes);
    options.push({ value, label: value });
  }
  return options;
}

/**
 * Posición vertical (en % del alto de la columna) de un bloque [start, end) en ms. Se recorta
 * al horario de atención para que un bloque que empieza antes de las 9 no se dibuje por
 * encima de la grilla.
 */
export function getSlotStyle(slot: { startTime: number; endTime: number }): {
  top: string;
  height: string;
} {
  const occStart = fromUtcMs(slot.startTime);
  const occEnd = fromUtcMs(slot.endTime);

  const startMinutes = occStart.getHours() * 60 + occStart.getMinutes();
  const endMinutes = occEnd.getHours() * 60 + occEnd.getMinutes();

  const businessStart = BUSINESS_HOURS.START * 60;
  const totalMinutes = BUSINESS_HOURS.END * 60 - businessStart;

  const top = ((startMinutes - businessStart) / totalMinutes) * 100;
  const height = ((endMinutes - startMinutes) / totalMinutes) * 100;

  return {
    top: `${Math.max(0, top)}%`,
    height: `${Math.max(0, Math.min(100 - Math.max(0, top), height))}%`,
  };
}

/**
 * Cuántos días se muestran a la vez según el ancho de la pantalla (milestone 14, decisión
 * Part A.1): 1 día por debajo de 640px, 3 entre 640 y 767px, la semana entera (5) desde
 * 768px. Con 5 columnas en un teléfono quedaban ~70px por día: ilegible e imposible de tocar.
 */
export function visibleDayCountFor(opts: {
  isSm: boolean;
  isMd: boolean;
}): number {
  if (opts.isMd) return WORK_WEEK_DAYS;
  if (opts.isSm) return 3;
  return 1;
}

/**
 * Índices (0 = lunes) de los días visibles: una ventana de `count` días que contiene al día
 * enfocado y, en lo posible, lo deja al centro; nunca se sale de la semana. Ej. con 3 días:
 * foco en lunes → [0,1,2]; foco en miércoles → [1,2,3]; foco en viernes → [2,3,4].
 */
export function visibleDayIndices(
  count: number,
  focused: number,
  total: number = WORK_WEEK_DAYS,
): number[] {
  const n = Math.max(1, Math.min(count, total));
  const f = Math.max(0, Math.min(focused, total - 1));
  const start = Math.max(0, Math.min(f - Math.floor((n - 1) / 2), total - n));
  return Array.from({ length: n }, (_, i) => start + i);
}

/**
 * Índice del primer día de `days` que todavía admite reservas (le queda algún turno), o `-1` si ninguno. Lo usa el calendario para abrir directamente en un día reservable
 * en vez de en uno rayado (hallazgo F).
 */
export function firstBookableDayIndex(days: Date[], clock: Date): number {
  return days.findIndex((d) => !isDayFullyBlocked(d, clock));
}

/**
 * Lunes de la "semana de trabajo actual" del calendario: la de hoy de lunes a viernes; la
 * siguiente si hoy es sábado o domingo (no queda nada reservable de la semana en curso). Hasta
 * el milestone 26 el viernes también saltaba a la semana siguiente, porque la anticipación de
 * 24 h ya había bloqueado el resto del viernes; sin esa regla, el viernes es reservable.
 */
export function getCurrentWorkWeekStart(now: Date): Date {
  const dayOfWeek = getDay(now); // 0 = domingo, 6 = sábado
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  return dayOfWeek === 0 || dayOfWeek === 6 ? addWeeks(monday, 1) : monday;
}

/**
 * Semana con la que abre el calendario (milestone 14, hallazgo F): la semana de trabajo
 * actual, salvo que **todos** sus días ya estén bloqueados (p. ej.
 * un viernes después del cierre) — en ese caso, la siguiente. Antes abría en una semana enteramente
 * rayada, sin un solo botón "Reservar", y parecía que no había lugar.
 */
export function firstBookableWeekStart(now: Date): Date {
  const current = getCurrentWorkWeekStart(now);
  const days = Array.from({ length: WORK_WEEK_DAYS }, (_, i) =>
    addDays(current, i),
  );
  return firstBookableDayIndex(days, now) === -1
    ? addWeeks(current, 1)
    : current;
}

/**
 * ¿Los cierres del espacio (`kind: "closed"`, milestone 23) cubren **todo** el horario de
 * reserva de `day`? Entonces no tiene sentido ofrecer «Reservar» ese día: se pediría algo que
 * el servidor va a rechazar. Une los cierres del día (dos cierres parciales contiguos, mañana y
 * tarde, también cierran el día completo). Los tramos ya vienen recortados al horario de reserva.
 */
export function isDayFullyClosed(
  day: Date,
  slots: ReadonlyArray<{ kind?: string; startTime: number; endTime: number }>,
): boolean {
  const minutes = (ms: number) => {
    const d = fromUtcMs(ms);
    return d.getHours() * 60 + d.getMinutes();
  };
  const closed = slots
    .filter(
      (s) => s.kind === "closed" && isSameDay(fromUtcMs(s.startTime), day),
    )
    .map((s) => [minutes(s.startTime), minutes(s.endTime)] as const)
    .sort((a, b) => a[0] - b[0]);
  let covered = BUSINESS_HOURS.START * 60;
  for (const [from, to] of closed) {
    if (from > covered) break;
    covered = Math.max(covered, to);
  }
  return covered >= BUSINESS_HOURS.END * 60;
}
