import { ParticipantStatus } from "@/types/prisma";

/**
 * Statuses that occupy a spot (count toward an event's capacity/cupo). A participant holds a
 * spot while awaiting approval (PENDING) or once approved (APPROVED); REJECTED/CANCELLED free it.
 * Used consistently for every capacity/"full" check so the rule doesn't diverge across call sites.
 */
export const SPOT_HOLDING_STATUSES: ParticipantStatus[] = [
  ParticipantStatus.PENDING,
  ParticipantStatus.APPROVED,
];

/** Spanish display label for each participant status. */
export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  [ParticipantStatus.PENDING]: "Pendiente",
  [ParticipantStatus.APPROVED]: "Aprobado",
  [ParticipantStatus.REJECTED]: "Rechazado",
  [ParticipantStatus.CANCELLED]: "Cancelado",
};

/**
 * Mensaje único para un envío que no puede crear ni reactivar una inscripción porque el correo
 * ya tiene una en ese evento. Es **el mismo** para una inscripción activa y para una rechazada
 * (milestone 25, S5): un mensaje distinto revelaría a cualquiera que tipee el correo de otra
 * persona que esa persona fue rechazada.
 */
export const ALREADY_REGISTERED_MESSAGE = "Ya estás inscripto con ese email";

/**
 * ¿Una inscripción previa con este estado impide volver a enviar el formulario con ese correo?
 *
 * - PENDING / APPROVED: es una inscripción activa (ocupa un lugar) → sí.
 * - REJECTED: la decidió un admin → **sí** (milestone 25, S5). Antes se reactivaba con el estado
 *   inicial del evento: en uno sin aprobación manual eso era APPROVED, así que el rechazo no valía
 *   nada, y en uno con aprobación quien fue rechazado podía reinscribirse sin fin y volver a
 *   aparecer en la cola del admin.
 * - CANCELLED: la canceló la propia persona → no, puede volver a inscribirse (la fila se reactiva).
 */
export function blocksReRegistration(status: ParticipantStatus): boolean {
  return status !== ParticipantStatus.CANCELLED;
}
