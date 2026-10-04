import { isOnLedgerGrid } from "@/lib/constants/reservations";
import {
  BOOKING_WINDOW_MESSAGES,
  checkBookingWindow,
  hasMinimumNotice,
  MINIMUM_NOTICE_MESSAGE,
} from "./booking-window";

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

  // Anticipación mínima real (24hs de margen), no por día calendario — ver el comentario de
  // MINIMUM_NOTICE_MS en booking-window.ts.
  if (!hasMinimumNotice(startMs, nowMs)) return MINIMUM_NOTICE_MESSAGE;

  // Reglas de día de semana + horario de apertura, comparadas en la zona horaria del propio
  // predio (milestone-12 D14).
  const violation = checkBookingWindow(startMs, endMs);
  if (violation) return BOOKING_WINDOW_MESSAGES[violation];

  return null;
}
