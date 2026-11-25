import {
  closureRejectionMessage,
  findClosureForWindow,
  type ClosureLike,
} from "@/lib/closed-days/closures";
import { isOnLedgerGrid } from "@/lib/constants/reservations";
import {
  BOOKING_HORIZON_DAYS,
  bookingHorizonMessage,
  isBeyondBookingHorizon,
} from "./booking-horizon";
import { BOOKING_WINDOW_MESSAGES, checkBookingWindow } from "./booking-window";

/**
 * Largo máximo de la **descripción** de una reserva (la columna `reason`). Lo usan el
 * formulario de la web (`BookingForm`), la tool MCP y {@link validateReservationReason} en el
 * servidor: antes solo lo limitaba el formulario, y un POST directo a
 * `/api/resources/[spaceId]` guardaba un texto de cualquier tamaño (auditoría de restricciones
 * de UI, milestone 26).
 */
export const RESERVATION_REASON_MAX = 1000;

/** Largo máximo del título de una reserva (milestone 35): es lo que se lee en el calendario. */
export const RESERVATION_TITLE_MAX = 80;

/**
 * Valida la descripción ya recortada. Devuelve el mensaje en castellano o `null` si es válida.
 * Desde el milestone 35 la descripción es **opcional** (lo obligatorio es el título): vacía es
 * válida, y solo se rechaza pasarse de {@link RESERVATION_REASON_MAX}.
 */
export function validateReservationReason(reason: string): string | null {
  if (reason.length > RESERVATION_REASON_MAX)
    return `La descripción admite hasta ${RESERVATION_REASON_MAX} caracteres`;
  return null;
}

/** Valida el título ya recortado: obligatorio y hasta {@link RESERVATION_TITLE_MAX}. */
export function validateReservationTitle(title: string): string | null {
  if (!title) return "Falta el título de la reserva";
  if (title.length > RESERVATION_TITLE_MAX)
    return `El título admite hasta ${RESERVATION_TITLE_MAX} caracteres`;
  return null;
}

/**
 * Título a partir de una descripción: su primera línea, recortada. Es lo que se usa cuando un
 * cliente que no conoce el título (el conector MCP anterior al milestone 35, una API vieja)
 * manda solo el texto de la reserva.
 */
export function titleFromDescription(description: string): string {
  const firstLine = description.trim().split(/\r?\n/)[0] ?? "";
  return firstLine.slice(0, RESERVATION_TITLE_MAX).trim();
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
  /** Días de horizonte de quien reserva: `bookingHorizonDaysFor(permisos)` (milestone 42). */
  horizonDays: number = BOOKING_HORIZON_DAYS,
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

  // Horizonte deslizante y por día local (milestone 26): dos semanas, o un año con el permiso
  // `reservations:extended-horizon` (milestone 42).
  if (isBeyondBookingHorizon(startMs, nowMs, horizonDays))
    return bookingHorizonMessage(nowMs, horizonDays);

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
