import { ADMIN_TIMEZONE } from "@/lib/admin/admin-timezone";
import { TZDate } from "@date-fns/tz";

/**
 * Cuándo se puede reservar un espacio, expresado en **hora local del predio**
 * (`ADMIN_TIMEZONE`).
 *
 * Las reglas en sí no cambian de intención — solo días de semana, de 09:00 a 18:00 —, pero
 * `POST /api/resources/[spaceId]` las validaba con `getUTCHours()` / `getUTCDay()` contra un
 * predio en UTC−3, y eso salía mal de tres formas (milestone-12 D14):
 *
 *  - la ventana estaba escrita como `startHour < 12 || endHour > 21`, y `endHour > 21` admite
 *    un fin a las 21:59 UTC = 18:59 local, una hora después del cierre declarado;
 *  - un `endHour === 18 && minutes > 0` que quedó de una versión anterior a UTC rechazaba
 *    cualquier reserva que terminara entre las 15:01 y las 15:59 **locales**, informando un
 *    mensaje sobre las 6 de la tarde;
 *  - `getUTCDay()` clasifica una reserva del viernes 21:30 local como sábado.
 *
 * Comparar en la zona del propio predio elimina los tres casos, y hace que las constantes se
 * lean como la regla que codifican en lugar de como offsets que alguien tiene que recalcular.
 */
export const BOOKING_OPEN_MINUTES = 9 * 60; // 09:00 local
export const BOOKING_CLOSE_MINUTES = 18 * 60; // 18:00 local

/** Minutos desde la medianoche local, en la zona del predio. */
function localMinutes(ms: number): number {
  const d = new TZDate(ms, ADMIN_TIMEZONE);
  return d.getHours() * 60 + d.getMinutes();
}

/** Día de la semana local en la zona del predio (0 = domingo .. 6 = sábado). */
function localWeekday(ms: number): number {
  return new TZDate(ms, ADMIN_TIMEZONE).getDay();
}

export type BookingWindowViolation = "weekend" | "outside_hours" | "overnight";

/**
 * Chequea una ventana de reserva contra las reglas de apertura del predio. Devuelve null si
 * está permitida; si no, qué regla incumple.
 *
 * `overnight` existe porque el chequeo de horario es por día: una ventana que cruza la
 * medianoche local se compararía contra los rangos de minutos de dos días distintos y podría
 * colarse. Rechazarla directamente coincide con la UI, que nunca ofrece una.
 */
export function checkBookingWindow(
  startMs: number,
  endMs: number,
): BookingWindowViolation | null {
  const weekday = localWeekday(startMs);
  if (weekday === 0 || weekday === 6) return "weekend";

  if (localWeekday(endMs) !== weekday) {
    // Excepción: un fin exactamente a la medianoche local es el cierre del día de inicio.
    if (localMinutes(endMs) !== 0) return "overnight";
  }

  const start = localMinutes(startMs);
  const end = localMinutes(endMs) === 0 ? 24 * 60 : localMinutes(endMs);
  if (start < BOOKING_OPEN_MINUTES || end > BOOKING_CLOSE_MINUTES) {
    return "outside_hours";
  }

  return null;
}

/** Mensaje en español para cada incumplimiento. */
export const BOOKING_WINDOW_MESSAGES: Record<BookingWindowViolation, string> = {
  weekend: "Las reservas solo están disponibles de lunes a viernes",
  outside_hours: "Las reservas deben estar entre las 9:00 y las 18:00",
  overnight: "La reserva debe empezar y terminar el mismo día",
};

/**
 * Anticipación mínima exigida para reservar, en horas.
 *
 * Reemplaza la regla anterior ("solo a partir de mañana", comparada por día calendario), que
 * dejaba colar reservas con menos de 24hs reales de aviso: alguien reservando hoy a las 23:00
 * para mañana a las 09:00 pasaba el chequeo por día pero tenía 10hs de anticipación, no 24.
 */
export const MINIMUM_NOTICE_HOURS = 24;
export const MINIMUM_NOTICE_MS = MINIMUM_NOTICE_HOURS * 60 * 60 * 1000;

export const MINIMUM_NOTICE_MESSAGE =
  "Las reservas deben realizarse con un mínimo de 24 horas de anticipación. Por favor, seleccioná una fecha y un horario que cumplan con ese plazo.";

/** true si `startMs` deja al menos `MINIMUM_NOTICE_HOURS` de margen desde `nowMs`. */
export function hasMinimumNotice(startMs: number, nowMs: number): boolean {
  return startMs - nowMs >= MINIMUM_NOTICE_MS;
}
