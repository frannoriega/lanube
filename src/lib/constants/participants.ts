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
