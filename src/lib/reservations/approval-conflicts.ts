/**
 * Lo que el admin necesita ver antes de aprobar una reserva que va a rechazar otras.
 *
 * Aprobar una reserva puede rechazar automáticamente reservas pendientes de otras personas
 * (`approve_reservation()` en SQL). El diálogo de confirmación antes listaba solo los ids
 * (cuid2) de esas reservas, que no le dicen nada a nadie: el admin aprobaba a ciegas. Estos
 * tipos describen cada reserva afectada con todo lo necesario para decidir — quién la pidió,
 * cuándo choca, cuántas personas, para qué y por qué se rechazaría — y los comparten la ruta
 * (`PATCH /api/admin/reservations/[id]` con `preview: true`) y el diálogo
 * (`ApprovalConflictsDialog`).
 *
 * Este módulo es puro (sin Prisma) para poder importarlo desde el cliente y testearlo.
 */

/**
 * Por qué aprobar la reserva rechazaría a esta otra. Replica las dos ramas de
 * `preview_approval_conflicts()`:
 * - `EXCLUSIVE`: mismo espacio, y el espacio es exclusivo (una sola reserva a la vez).
 * - `CAPACITY`: mismo espacio compartido; juntas superarían la capacidad.
 * - `SAME_PERSON`: la misma persona tiene otra reserva pendiente, en otro espacio, a la
 *   misma hora (no puede estar en dos lugares).
 */
export type ApprovalConflictKind = "EXCLUSIVE" | "CAPACITY" | "SAME_PERSON";

/** Una franja de tiempo en ms UTC. */
export interface TimeWindow {
  start: number;
  end: number;
}

/** Una reserva pendiente que aprobar la reserva elegida rechazaría automáticamente. */
export interface ApprovalConflict {
  id: string;
  kind: ApprovalConflictKind;
  /** Nombre y apellido; `null` si no es una reserva de una persona (equipo/organización). */
  ownerName: string | null;
  email: string | null;
  institution: string | null;
  spaceName: string | null;
  reservationTypeName: string;
  /** Lo que escribió la persona al reservar. */
  reason: string;
  /** Personas que representa la reserva (cuentan contra la capacidad). */
  actorSize: number;
  isRecurring: boolean;
  /** Cuándo se pidió (ms UTC): sirve para ver quién reservó primero. */
  createdAt: number;
  /**
   * Las franjas en las que esta reserva se superpone con la que se va a aprobar, en orden.
   * En una reserva recurrente puede ser más de una (una por fecha que choca), y la primera
   * no tiene por qué coincidir con el `startTime` de la reserva.
   */
  overlaps: TimeWindow[];
}

/** Respuesta de la vista previa de aprobación. */
export interface ApprovalPreview {
  /** Ids de las reservas que se rechazarían (se mantiene por compatibilidad). */
  autoRejectedIds: string[];
  conflicts: ApprovalConflict[];
  /** El espacio de la reserva que se va a aprobar, para explicar los rechazos por capacidad. */
  space: { name: string; capacity: number; isExclusive: boolean } | null;
}

/**
 * Une franjas que se tocan o se pisan en franjas continuas, ordenadas por inicio.
 *
 * El ledger guarda cada ocurrencia en buckets de 15 minutos, así que la superposición entre
 * dos reservas llega como una lista de buckets sueltos; sin unirlos, una superposición de una
 * hora se mostraría como cuatro.
 */
export function mergeWindows(windows: TimeWindow[]): TimeWindow[] {
  const sorted = [...windows].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
  const merged: TimeWindow[] = [];
  for (const w of sorted) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) {
      last.end = Math.max(last.end, w.end);
    } else {
      merged.push({ start: w.start, end: w.end });
    }
  }
  return merged;
}

/**
 * Clasifica el motivo del rechazo comparando el espacio de la reserva afectada con el de la
 * que se aprueba (ver {@link ApprovalConflictKind}).
 */
export function classifyConflict(
  conflictSpaceId: string | null,
  target: { spaceId: string | null; isExclusive: boolean },
): ApprovalConflictKind {
  if (conflictSpaceId !== target.spaceId) return "SAME_PERSON";
  return target.isExclusive ? "EXCLUSIVE" : "CAPACITY";
}
