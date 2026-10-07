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

/**
 * De qué estados sale cada decisión del admin (milestone 25, seguimiento de S5):
 *
 * - **Aprobar**: PENDING (ya ocupa un lugar, el cupo no cambia) y **REJECTED** (volver a aprobar
 *   a alguien rechazado: como el rechazo es lo único que lo deja afuera —no puede reinscribirse,
 *   ver {@link blocksReRegistration}—, esta es la única vuelta posible). Re-aprobar ocupa un lugar
 *   de nuevo, así que pasa por {@link reapprovalFits}. Aprobar a un APPROVED es un no-op (no se
 *   vuelve a mandar el correo).
 * - **Rechazar**: PENDING y APPROVED (se puede revocar una aprobación).
 *
 * CANCELLED nunca: la canceló la propia persona, y ninguna decisión la resucita.
 */
export const DECISION_SOURCE_STATUSES: Record<
  "approve" | "reject",
  ParticipantStatus[]
> = {
  approve: [ParticipantStatus.PENDING, ParticipantStatus.REJECTED],
  reject: [ParticipantStatus.PENDING, ParticipantStatus.APPROVED],
};

/**
 * ¿Entran `reapproving` inscripciones rechazadas que se quieren volver a aprobar, con `taken`
 * lugares ya ocupados (`SPOT_HOLDING_STATUSES`) y un cupo de `capacity` (0 = sin cupo)?
 *
 * Todo o nada (decisión del usuario): si no entran todas no se aprueba ninguna, y el admin elige
 * a quién. `free` son los lugares que quedan, para el mensaje.
 */
export function reapprovalFits({
  capacity,
  taken,
  reapproving,
}: {
  capacity: number;
  taken: number;
  reapproving: number;
}): { fits: boolean; free: number | null } {
  if (capacity <= 0) return { fits: true, free: null };
  const free = Math.max(0, capacity - taken);
  return { fits: reapproving <= free, free };
}
