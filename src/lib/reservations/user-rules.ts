import {
  closureRejectionMessage,
  findClosureForWindow,
  type ClosureLike,
} from "@/lib/closed-days/closures";
import { isOnLedgerGrid } from "@/lib/constants/reservations";
import {
  bookingHorizonMessage,
  isBeyondBookingHorizon,
} from "./booking-horizon";
import { BOOKING_WINDOW_MESSAGES, checkBookingWindow } from "./booking-window";

/**
 * Largo máximo del motivo de una reserva. Lo usan el formulario de la web (`BookingForm`), la
 * tool MCP y {@link validateReservationReason} en el servidor: antes solo lo limitaba el
 * formulario, y un POST directo a `/api/resources/[spaceId]` guardaba un motivo de cualquier
 * tamaño (auditoría de restricciones de UI, milestone 26).
 */
export const RESERVATION_REASON_MAX = 1000;

/**
 * Valida el motivo ya recortado. Devuelve el mensaje en castellano o `null` si es válido.
 * Es la misma regla que el schema del formulario: no vacío y hasta {@link RESERVATION_REASON_MAX}.
 */
export function validateReservationReason(reason: string): string | null {
  if (!reason) return "Faltan campos requeridos";
  if (reason.length > RESERVATION_REASON_MAX)
    return `El motivo admite hasta ${RESERVATION_REASON_MAX} caracteres`;
  return null;
}

/**
 * Reglas **puras** (sin base, sin reloj propio) que un usuario tiene que cumplir para pedir
 * una reserva. Separadas de `user-actions.ts` para poder testearlas sin Prisma.
 *
 * Devuelve `null` si la ventana es válida, o el mensaje en castellano de la primera regla que
 * incumple — el mismo texto que la web le mostraba al usuario, así el asistente MCP recibe
 * exactamente el mismo motivo. El orden importa: es el orden en que el route handler las
 * chequeaba antes del milestone 20, y define qué mensaje se ve cuando fallan varias.
 */
export function validateUserReservationWindow(
  startMs: number,
  endMs: number,
  nowMs: number,
): string | null {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs))
    return "startTime y endTime deben ser milisegundos UTC válidos";

  if (startMs >= endMs)
    return "La hora de inicio debe ser anterior a la hora de fin";

  // Mantener toda reserva en la grilla de 15 minutos del ledger. La UI solo ofrece horarios
  // alineados; la API nunca los exigió, y eso es lo que hacía explotable a mano el chequeo
  // de capacidad vacuo (ya corregido) — ver milestone-12 D4.
  if (!isOnLedgerGrid(startMs) || !isOnLedgerGrid(endMs))
    return "Las reservas deben empezar y terminar en intervalos de 15 minutos";

  if (startMs < nowMs) return "No se pueden hacer reservas en el pasado";

  // Horizonte de dos semanas, deslizante y por día local (milestone 26): pasado el último día
  // reservable no puede haber reservas de usuarios, así los eventos del equipo nunca las pisan.
  if (isBeyondBookingHorizon(startMs, nowMs))
    return bookingHorizonMessage(nowMs);

  // Sin anticipación mínima (desde el milestone 26): vale cualquier turno que empiece desde
  // `now` en adelante. Hasta entonces se exigían 24 h de margen.

  // Reglas de día de semana + horario de apertura, comparadas en la zona horaria del propio
  // predio (milestone-12 D14).
  const violation = checkBookingWindow(startMs, endMs);
  if (violation) return BOOKING_WINDOW_MESSAGES[violation];

  return null;
}

/**
 * Chequea la ventana contra los **cierres activos** del espacio (milestone 23). Devuelve el
 * mensaje en castellano —con el motivo del cierre— o `null` si ninguno la toca.
 *
 * Va aparte de {@link validateUserReservationWindow} porque esa es síncrona y sin datos: los
 * cierres salen de la base, así que quien llama los trae y los pasa. Corre **después** de las
 * reglas de apertura: un sábado ya se rechaza como «solo de lunes a viernes», y no hace falta
 * decir además que un feriado que cae en sábado lo cierra.
 */
export function validateAgainstClosures(
  startMs: number,
  endMs: number,
  closures: readonly ClosureLike[],
): string | null {
  const closure = findClosureForWindow(startMs, endMs, closures);
  return closure ? closureRejectionMessage(closure) : null;
}
