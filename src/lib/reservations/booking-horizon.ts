import {
  addDaysToDateKey,
  startOfDateKeyMs,
  todayDateKeyInAdminTz,
} from "@/lib/admin/admin-timezone";

/**
 * Horizonte de reserva de los usuarios (milestone 26): **una ventana deslizante exacta** de
 * dos semanas.
 *
 * Existe para que quien organiza eventos tenga certeza: pasado el horizonte no puede haber
 * ninguna reserva de un usuario, así que un evento ahí nunca pisa nada. Por eso la regla se
 * hace cumplir **en el servidor** (`validateUserReservationWindow`, que comparten la web y el
 * asistente MCP) y no solo en el calendario. Los administradores no están sujetos a ella.
 *
 * La granularidad es el **día local del predio**, inclusivo: hoy miércoles 1, se puede reservar
 * hasta el cierre del miércoles 15. Antes la ventana era «semana de trabajo actual + la
 * siguiente» y se achicaba a medida que avanzaba la semana (de 11 días un lunes a 8 un viernes).
 *
 * Todo en zona del predio (`ADMIN_TIMEZONE`), como el resto de las reglas de reserva.
 */
export const BOOKING_HORIZON_DAYS = 14;

/** Último día (`YYYY-MM-DD`, inclusivo) en que se puede reservar, visto desde `nowMs`. */
export function bookingHorizonLastDateKey(nowMs: number): string {
  return addDaysToDateKey(todayDateKeyInAdminTz(nowMs), BOOKING_HORIZON_DAYS);
}

/**
 * Instante (ms UTC, **exclusivo**) a partir del cual ya no se puede reservar: la medianoche
 * local que sigue al último día del horizonte. Una reserva es válida si empieza antes.
 */
export function bookingHorizonEndMs(nowMs: number): number {
  return startOfDateKeyMs(
    addDaysToDateKey(bookingHorizonLastDateKey(nowMs), 1),
  );
}

/** true si el instante `ms` cae después del último día reservable. */
export function isBeyondBookingHorizon(ms: number, nowMs: number): boolean {
  return ms >= bookingHorizonEndMs(nowMs);
}

/** `2026-11-25` → `25/11/2026` (formato de fecha de la app). */
function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

/** Mensaje en castellano cuando una reserva pasa del horizonte. Dice hasta cuándo se puede. */
export function bookingHorizonMessage(nowMs: number): string {
  return `Solo se puede reservar con hasta 2 semanas de anticipación: hasta el ${formatDateKey(
    bookingHorizonLastDateKey(nowMs),
  )} inclusive.`;
}
