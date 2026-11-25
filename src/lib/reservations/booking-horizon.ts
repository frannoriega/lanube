import {
  addDaysToDateKey,
  startOfDateKeyMs,
  todayDateKeyInAdminTz,
} from "@/lib/admin/admin-timezone";
import { hasPermission, type PermissionSet } from "@/lib/rbac";

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
 *
 * **Horizonte extendido (milestone 42):** quien tiene el permiso `reservations:extended-horizon`
 * reserva con hasta un año de anticipación (ventana deslizante de 365 días). Con eso la garantía
 * de arriba deja de valer para esas personas, y el usuario lo aceptó a propósito (2026-11-25): el
 * permiso es para **roles de gestión**, los mismos que arman la agenda de eventos, así que una
 * reserva lejana nunca aparece «de la nada». No hay aviso ni bloqueo extra por eso.
 *
 * Todas las funciones reciben los días del horizonte (por defecto, el de cualquier usuario); el
 * de una persona sale **siempre** de `bookingHorizonDaysFor(permisos)` — nadie compara contra las
 * constantes directo.
 */
export const BOOKING_HORIZON_DAYS = 14;

/** Horizonte de quien tiene `reservations:extended-horizon` (milestone 42): un año. */
export const EXTENDED_BOOKING_HORIZON_DAYS = 365;

/** Días de horizonte de una persona según sus permisos (el superadmin los tiene todos). */
export function bookingHorizonDaysFor(
  permissions: PermissionSet | null | undefined,
): number {
  return hasPermission(permissions, "reservations:extended-horizon")
    ? EXTENDED_BOOKING_HORIZON_DAYS
    : BOOKING_HORIZON_DAYS;
}

/** Último día (`YYYY-MM-DD`, inclusivo) en que se puede reservar, visto desde `nowMs`. */
export function bookingHorizonLastDateKey(
  nowMs: number,
  days: number = BOOKING_HORIZON_DAYS,
): string {
  return addDaysToDateKey(todayDateKeyInAdminTz(nowMs), days);
}

/**
 * Instante (ms UTC, **exclusivo**) a partir del cual ya no se puede reservar: la medianoche
 * local que sigue al último día del horizonte. Una reserva es válida si empieza antes.
 */
export function bookingHorizonEndMs(
  nowMs: number,
  days: number = BOOKING_HORIZON_DAYS,
): number {
  return startOfDateKeyMs(
    addDaysToDateKey(bookingHorizonLastDateKey(nowMs, days), 1),
  );
}

/** true si el instante `ms` cae después del último día reservable. */
export function isBeyondBookingHorizon(
  ms: number,
  nowMs: number,
  days: number = BOOKING_HORIZON_DAYS,
): boolean {
  return ms >= bookingHorizonEndMs(nowMs, days);
}

/** `2026-11-25` → `25/11/2026` (formato de fecha de la app). */
function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

/** «2 semanas» / «1 año» / «N días»: cómo se dice un horizonte en los mensajes. */
export function horizonLabel(days: number): string {
  if (days === EXTENDED_BOOKING_HORIZON_DAYS) return "1 año";
  if (days % 7 === 0) return `${days / 7} semanas`;
  return `${days} días`;
}

/** Mensaje en castellano cuando una reserva pasa del horizonte. Dice hasta cuándo se puede. */
export function bookingHorizonMessage(
  nowMs: number,
  days: number = BOOKING_HORIZON_DAYS,
): string {
  return `Solo se puede reservar con hasta ${horizonLabel(days)} de anticipación: hasta el ${formatDateKey(
    bookingHorizonLastDateKey(nowMs, days),
  )} inclusive.`;
}
