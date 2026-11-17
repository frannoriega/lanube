import { dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import type { EventOccurrence } from "@/lib/events/occurrences";
import { ParticipantStatus } from "@/types/prisma";

/**
 * Reglas puras del check-in de eventos (milestone 30). Sin base ni reloj: reciben las
 * sesiones ya expandidas (`expandAllEventOccurrences`) y el "ahora", así se testean solas
 * (`checkin.test.ts`). `src/lib/db/event-checkin.ts` las usa del lado del servidor y la
 * pantalla de la puerta para elegir la sesión por defecto.
 */

/** Una sesión a la que se le puede hacer check-in, como la ve la pantalla. */
export interface CheckInSession {
  reservationId: string;
  /** Inicio **nominal** (UNIX ms): la clave de la sesión (`EventCheckIn.occurrenceStart`). */
  occurrenceStart: number;
  /** Horario efectivo (distinto del nominal si se reprogramó). */
  startMs: number;
  endMs: number;
  rescheduled: boolean;
  /**
   * `open`: se puede registrar ingreso (es de hoy o ya pasó — se puede cargar asistencia
   * después). `future`: de un día que todavía no llegó; se lista pero no admite ingresos.
   */
  state: "open" | "future";
}

/**
 * ¿Se puede registrar ingreso a una sesión que empieza en `startMs`? Sí si su día (en la hora
 * del predio) es hoy o anterior. Se compara por **día** y no por hora: la gente llega antes
 * de que empiece, y hay que poder recibirla.
 */
export function isSessionOpenForCheckIn(startMs: number, nowMs: number) {
  return dateKeyFromUnixMs(startMs) <= dateKeyFromUnixMs(nowMs);
}

/**
 * Las sesiones de un evento que admiten check-in, ordenadas por horario: todas menos las
 * canceladas (una sesión cancelada no tuvo asistentes).
 */
export function checkInSessions(
  occurrences: EventOccurrence[],
  nowMs: number,
): CheckInSession[] {
  return occurrences
    .filter((o) => o.status !== "cancelled")
    .map((o) => ({
      reservationId: o.reservationId,
      occurrenceStart: o.occurrenceDateMs,
      startMs: o.startMs,
      endMs: o.endMs,
      rescheduled: o.status === "rescheduled",
      state: isSessionOpenForCheckIn(o.startMs, nowMs)
        ? ("open" as const)
        : ("future" as const),
    }))
    .sort((a, b) => a.startMs - b.startMs);
}

/**
 * La sesión que la pantalla muestra al abrir:
 * 1. una de **hoy**: la primera que todavía no terminó (la en curso o la próxima); si todas
 *    las de hoy terminaron, la última de hoy;
 * 2. si hoy no hay, la **última que ya pasó** (cargar asistencia después);
 * 3. si no pasó ninguna, la primera futura (la pantalla la muestra sin poder registrar).
 *
 * Devuelve `null` solo si el evento no tiene sesiones.
 */
export function defaultCheckInSession(
  sessions: CheckInSession[],
  nowMs: number,
): CheckInSession | null {
  if (sessions.length === 0) return null;
  const today = dateKeyFromUnixMs(nowMs);
  const todays = sessions.filter((s) => dateKeyFromUnixMs(s.startMs) === today);
  if (todays.length > 0) {
    return todays.find((s) => s.endMs > nowMs) ?? todays[todays.length - 1];
  }
  const past = sessions.filter((s) => s.state === "open");
  if (past.length > 0) return past[past.length - 1];
  return sessions[0];
}

/**
 * Qué hace falta para registrar el ingreso de una inscripción según su estado:
 * - `APPROVED` → se registra directo.
 * - `PENDING` / `REJECTED` / `CANCELLED` → hay que **admitirla**: la pantalla pide
 *   confirmación y el ingreso la deja `APPROVED`. Lo decide quien está en la puerta, con la
 *   persona adelante (decisión del usuario: «los admins lo manejan en persona»), así que no
 *   se chequea el cupo — igual que con quien llega sin inscripción — ni se manda correo.
 */
export function checkInRequiresAdmission(status: ParticipantStatus): boolean {
  return status !== ParticipantStatus.APPROVED;
}

/** Texto de la confirmación de «admitir» para cada estado que la necesita. */
export const ADMISSION_PROMPT: Record<
  Exclude<ParticipantStatus, ParticipantStatus.APPROVED>,
  string
> = {
  [ParticipantStatus.PENDING]:
    "Su inscripción está pendiente de aprobación. Al registrar el ingreso queda aprobada.",
  [ParticipantStatus.REJECTED]:
    "Su inscripción fue rechazada. Si la dejás pasar, queda aprobada y ocupa un lugar en las próximas sesiones.",
  [ParticipantStatus.CANCELLED]:
    "Canceló su inscripción. Si la dejás pasar, se reactiva y ocupa un lugar en las próximas sesiones.",
};
