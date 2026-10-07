import { prisma } from "@/lib/prisma";

/**
 * Lecturas por **ocurrencia** de reserva (milestone 25, C3): una serie recurrente aporta cada
 * ocurrencia que cae en el período, con sus excepciones (canceladas fuera, reprogramadas en su
 * ventana nueva). La expansión vive en SQL, `reservation_occurrences()` (migración
 * `20261008110000`), con la misma regla que arma el ledger; acá solo se arman consultas sobre
 * ella. Ver también `adminReports.ts` (reportes) y `adminReservations.ts` (listados).
 */

/**
 * Fin abierto para «de acá en adelante». Una serie se expande como mucho un año desde su
 * inicio (el mismo tope que el ledger), así que no hace falta un fin real; este es el máximo
 * que `to_timestamp` acepta sin salirse de rango (año 9999).
 */
export const OPEN_END_MS = 253_402_300_799_999;

/** Filtro opcional por dueño de la reserva: recorta las series antes de expandirlas. */
export interface OccurrenceOwner {
  reservableType: "USER" | "TEAM" | "ORG" | "EVENT";
  reservableId: string;
}

/**
 * Cuántas ocurrencias **aprobadas** empiezan en [fromMs, toMs], y cuánto suman sus duraciones.
 * Sin dueño, cuenta las de personas (excluye las de eventos, como toda vista de gestión de
 * reservas: ver `EXCLUDE_EVENT_RESERVATIONS`).
 */
export async function approvedOccurrenceTotals(
  fromMs: number,
  toMs: number,
  owner?: OccurrenceOwner,
): Promise<{ count: number; totalMs: number }> {
  const [row] = await prisma.$queryRaw<{ count: number; total_ms: number }[]>`
    SELECT COUNT(*)::int AS count,
           COALESCE(SUM(GREATEST(o.occurrence_end_time - o.occurrence_start_time, 0)), 0)::float8
             AS total_ms
    FROM reservation_occurrences(
      ${BigInt(fromMs)},
      ${BigInt(toMs)},
      ${owner?.reservableType ?? null}::reservable_types,
      ${owner?.reservableId ?? null}::text
    ) o
    JOIN reservations r ON r.id = o.reservation_id
    WHERE r.status = 'APPROVED'
      AND (${owner != null} OR r.reservable_type <> 'EVENT')`;
  return { count: row?.count ?? 0, totalMs: row?.total_ms ?? 0 };
}
