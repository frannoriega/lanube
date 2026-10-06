import { nowMs } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import { endOfDateKeyMs, startOfDateKeyMs } from "@/lib/admin/admin-timezone";
import {
  findClosureForWindow,
  type ClosureLike,
} from "@/lib/closed-days/closures";
import {
  mergeWindows,
  type TimeWindow,
} from "@/lib/reservations/approval-conflicts";

/**
 * Una reserva (o un evento) que un cierre pisa, con lo que el admin necesita para resolverla
 * (milestone 23, slice 6). Serializable: la página lo pasa tal cual a componentes de cliente.
 */
export interface ClosureImpactItem {
  reservationId: string;
  kind: "USER" | "EVENT";
  /** Solo `EVENT`: el evento dueño de la reserva, para linkear a sus sesiones. */
  eventId: string | null;
  /** Quién pidió la reserva (nombre y correo) o el nombre del evento. */
  who: string;
  contact: string | null;
  reason: string;
  status: "PENDING" | "APPROVED";
  isRecurring: boolean;
  /** Franjas que chocan con el cierre, ya unidas (el ledger va en buckets de 15 min). */
  windows: TimeWindow[];
}

/**
 * Las reservas **vigentes** (pendientes o aprobadas, que todavía no terminaron) que se
 * solapan con el cierre. Es lo que un cierre nuevo deja sin resolver: el ledger no conoce los
 * cierres (ver docs/milestones/milestones-23-closed-days.md), así que ni los eventos
 * semanales ni las reservas recurrentes se omiten solos — se marcan para que un admin decida.
 *
 * Se lee del ledger por buckets de 15 minutos y se filtran los que caen dentro de las franjas
 * reales del cierre con la misma `findClosureForWindow` que usa la regla de reserva, así
 * «afectada» significa exactamente lo mismo que «no se puede reservar».
 */
export async function getReservationsAffectedByClosure(
  closure: ClosureLike,
): Promise<ClosureImpactItem[]> {
  const rangeStart = Math.max(startOfDateKeyMs(closure.startDate), nowMs());
  const rangeEnd = endOfDateKeyMs(closure.endDate) + 1;
  if (rangeStart >= rangeEnd) return [];

  const buckets = await prisma.reservationLedger.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED"] },
      occurrenceStartTime: { lt: BigInt(rangeEnd) },
      occurrenceEndTime: { gt: BigInt(rangeStart) },
    },
    select: {
      reservationId: true,
      occurrenceStartTime: true,
      occurrenceEndTime: true,
    },
    orderBy: { occurrenceStartTime: "asc" },
  });

  const byReservation = new Map<string, TimeWindow[]>();
  for (const b of buckets) {
    const start = Number(b.occurrenceStartTime);
    const end = Number(b.occurrenceEndTime);
    if (!findClosureForWindow(start, end, [closure])) continue;
    const list = byReservation.get(b.reservationId) ?? [];
    list.push({ start, end });
    byReservation.set(b.reservationId, list);
  }
  if (byReservation.size === 0) return [];

  const reservations = await prisma.reservation.findMany({
    where: { id: { in: [...byReservation.keys()] } },
    select: {
      id: true,
      reservableType: true,
      reservableId: true,
      reason: true,
      status: true,
      isRecurring: true,
      registeredUser: {
        select: {
          name: true,
          lastName: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  const eventIds = reservations
    .filter((r) => r.reservableType === "EVENT")
    .map((r) => r.reservableId);
  const events = eventIds.length
    ? await prisma.event.findMany({
        where: { id: { in: eventIds } },
        select: { id: true, name: true },
      })
    : [];
  const eventName = new Map(events.map((e) => [e.id, e.name]));

  const items: ClosureImpactItem[] = reservations.map((r) => {
    const isEvent = r.reservableType === "EVENT";
    const person = r.registeredUser;
    return {
      reservationId: r.id,
      kind: isEvent ? "EVENT" : "USER",
      eventId: isEvent ? r.reservableId : null,
      who: isEvent
        ? (eventName.get(r.reservableId) ?? "Evento")
        : person
          ? `${person.name} ${person.lastName}`
          : "Usuario",
      contact: isEvent ? null : (person?.user?.email ?? null),
      reason: r.reason ?? "",
      status: r.status as "PENDING" | "APPROVED",
      isRecurring: r.isRecurring,
      windows: mergeWindows(byReservation.get(r.id) ?? []),
    };
  });
  // Primero lo que ocurre antes: es lo más urgente de resolver.
  return items.sort(
    (a, b) => (a.windows[0]?.start ?? 0) - (b.windows[0]?.start ?? 0),
  );
}
