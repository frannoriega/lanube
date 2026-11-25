import { TZDate } from "@date-fns/tz";
import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import { LEDGER_SLOT_MS } from "@/lib/constants/reservations";
import { bookingHorizonEndMs } from "@/lib/reservations/booking-horizon";
import {
  BOOKING_CLOSE_MINUTES,
  BOOKING_OPEN_MINUTES,
} from "@/lib/reservations/booking-window";

/**
 * Huecos libres de un espacio para la tool `get_availability` (milestone 20). Puro y
 * testeado: la parte con base (los bloques ocupados) la pone el llamador.
 *
 * Parte de las **mismas reglas** que valida `requestUserReservation` — días hábiles, el horario
 * de reserva en la zona del predio, nada en el pasado, grilla de 15 minutos — para que lo que
 * el asistente ve como "libre" sea efectivamente reservable. Lo único que no puede anticipar
 * es una reserva aprobada entre la consulta y el pedido; en ese caso el pedido falla con el
 * mensaje de siempre.
 */

export interface BusyBlock {
  startMs: number;
  endMs: number;
}

export interface FreeWindow {
  startMs: number;
  endMs: number;
}

export interface DayAvailability {
  /** Medianoche local del día (ms). */
  dayStartMs: number;
  windows: FreeWindow[];
}

/** Redondea hacia arriba a la grilla de 15 minutos. */
function ceilToGrid(ms: number): number {
  return Math.ceil(ms / LEDGER_SLOT_MS) * LEDGER_SLOT_MS;
}

/**
 * Para cada día hábil entre `fromDayMs` (medianoche local, inclusive) y `toDayMs` (medianoche
 * local, exclusive), los tramos libres dentro del horario de apertura, descontando `busy`, lo
 * que cae antes de `nowMs` o después del horizonte de la persona (dos semanas, o un año con
 * `reservations:extended-horizon`: milestone 42), y los tramos de menos de `minDurationMs`.
 */
export function computeFreeWindows(input: {
  fromDayMs: number;
  toDayMs: number;
  busy: BusyBlock[];
  nowMs: number;
  minDurationMs?: number;
  /** Días de horizonte de quien pregunta (milestone 42); por defecto, dos semanas. */
  horizonDays?: number;
}): DayAvailability[] {
  const minDuration = input.minDurationMs ?? LEDGER_SLOT_MS;
  const earliest = ceilToGrid(input.nowMs);
  const horizonEndMs = bookingHorizonEndMs(input.nowMs, input.horizonDays);
  const busy = [...input.busy].sort((a, b) => a.startMs - b.startMs);
  const days: DayAvailability[] = [];

  // Se avanza por fecha local (no sumando 24 h) para no depender de que el día dure 24 h.
  let cursor = new TZDate(input.fromDayMs, ADMIN_TIMEZONE);
  while (cursor.getTime() < input.toDayMs) {
    const weekday = cursor.getDay();
    const dayStartMs = cursor.getTime();
    // Pasado el horizonte de la persona no se ofrece nada (el servidor lo rechazaría).
    if (dayStartMs >= horizonEndMs) break;
    if (weekday !== 0 && weekday !== 6) {
      const open = new TZDate(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
        Math.floor(BOOKING_OPEN_MINUTES / 60),
        BOOKING_OPEN_MINUTES % 60,
        0,
        0,
        ADMIN_TIMEZONE,
      ).getTime();
      const close = new TZDate(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
        Math.floor(BOOKING_CLOSE_MINUTES / 60),
        BOOKING_CLOSE_MINUTES % 60,
        0,
        0,
        ADMIN_TIMEZONE,
      ).getTime();

      const windows: FreeWindow[] = [];
      let start = Math.max(open, earliest);
      for (const b of busy) {
        if (b.endMs <= start || b.startMs >= close) continue;
        if (b.startMs > start)
          windows.push({ startMs: start, endMs: b.startMs });
        start = Math.max(start, b.endMs);
      }
      if (start < close) windows.push({ startMs: start, endMs: close });

      const usable = windows.filter((w) => w.endMs - w.startMs >= minDuration);
      days.push({ dayStartMs, windows: usable });
    }
    cursor = new TZDate(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
      0,
      0,
      0,
      0,
      ADMIN_TIMEZONE,
    );
  }
  return days;
}
