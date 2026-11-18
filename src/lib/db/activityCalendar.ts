import { nowMs } from "@/lib/clock";
import {
  closureItems,
  maintenanceItems,
  type ActivityCalendarData,
  type CalendarItem,
} from "@/lib/calendar/activity";
import { SPOT_HOLDING_STATUSES } from "@/lib/constants/participants";
import { getActiveClosuresForWindow } from "@/lib/db/closedDays";
import { prisma } from "@/lib/prisma";

/**
 * Datos del calendario de actividades (milestone 32): todo lo que pasa en La Nube en
 * `[fromMs, toMs]`. Ver `docs/milestones/milestones-32-activity-calendar.md`.
 *
 * Las reservas (de personas y de eventos) salen de `reservation_occurrences()`: cada serie
 * recurrente se expande con sus excepciones con la misma regla que el ledger, y lee
 * `reservations` (no el ledger, que la tarea diaria poda hacia atrás). Una ocurrencia cuenta
 * si **empieza** en la ventana. Solo pendientes y aprobadas: lo rechazado o cancelado no
 * ocupa nada.
 *
 * **Vista de usuario (milestone 35):** solo sus reservas y los eventos publicados (más los días
 * cerrados). Las reservas ajenas **no se piden siquiera** a la base, y los eventos no publicados
 * no se muestran: antes llegaban como «Ocupado» y, con todos los espacios a la vez, un mismo
 * horario juntaba un bloque por espacio y por cupo, ilegible. Para ver la disponibilidad se usa el
 * calendario de cada espacio.
 */

interface OccurrenceRow {
  reservation_id: string;
  occurrence_start_time: bigint;
  occurrence_end_time: bigint;
  status: "PENDING" | "APPROVED";
  title: string;
  reason: string;
  reservable_type: "USER" | "TEAM" | "ORGANIZATION" | "EVENT";
  reservable_id: string;
  space_id: string | null;
  space_name: string | null;
  space_capacity: number | null;
  actor_size: number;
  requester: string | null;
}

function loadOccurrences(
  fromMs: number,
  toMs: number,
  spaceId?: string,
  onlyUserId?: string,
) {
  return prisma.$queryRaw<OccurrenceRow[]>`
    SELECT o.reservation_id, o.occurrence_start_time, o.occurrence_end_time,
           r.status::text AS status, r.title, r.reason, r.reservable_type::text AS reservable_type,
           r.reservable_id, r.space_id, s.name AS space_name,
           s.capacity AS space_capacity,
           get_actor_size(r.reservable_type, r.reservable_id) AS actor_size,
           CASE r.reservable_type
             WHEN 'USER' THEN ru.name || ' ' || ru.last_name
             WHEN 'TEAM' THEN 'Equipo ' || t.name
             WHEN 'ORGANIZATION' THEN org.name
           END AS requester
    FROM reservation_occurrences(
      ${BigInt(fromMs)}, ${BigInt(toMs)}, NULL, NULL, ${spaceId ?? null}::text
    ) o
    JOIN reservations r ON r.id = o.reservation_id
    LEFT JOIN spaces s ON s.id = r.space_id
    LEFT JOIN registered_users ru
      ON r.reservable_type = 'USER' AND ru.id = r.reservable_id
    LEFT JOIN teams t ON r.reservable_type = 'TEAM' AND t.id = r.reservable_id
    LEFT JOIN organizations org
      ON r.reservable_type = 'ORGANIZATION' AND org.id = r.reservable_id
    WHERE r.status IN ('PENDING', 'APPROVED')
      AND (${onlyUserId ?? null}::text IS NULL
        OR r.reservable_type = 'EVENT'
        OR (r.reservable_type = 'USER' AND r.reservable_id = ${onlyUserId ?? null}::text))
    ORDER BY o.occurrence_start_time`;
}

async function loadEvents(ids: string[]) {
  if (ids.length === 0) return new Map();
  const events = await prisma.event.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      summary: true,
      imageUrl: true,
      status: true,
      deletedAt: true,
      capacity: true,
      space: { select: { capacity: true } },
      form: {
        select: {
          slug: true,
          isPublished: true,
          opensAt: true,
          closesAt: true,
        },
      },
      _count: {
        select: {
          participants: { where: { status: { in: SPOT_HOLDING_STATUSES } } },
        },
      },
    },
  });
  return new Map(events.map((e) => [e.id, e]));
}

type EventMeta =
  Awaited<ReturnType<typeof loadEvents>> extends Map<string, infer V>
    ? V
    : never;

/** ¿La inscripción del evento está abierta ahora? Misma regla que el calendario de reservas. */
function registrationOpen(e: EventMeta, now: number): boolean {
  const cap = e.capacity ?? e.space.capacity;
  const full = cap !== null && e._count.participants >= cap;
  return Boolean(
    e.form?.isPublished &&
    Number(e.form.opensAt) <= now &&
    now <= Number(e.form.closesAt) &&
    !full,
  );
}

function eventItem(
  row: OccurrenceRow,
  e: EventMeta | undefined,
  viewer: CalendarViewer,
  now: number,
): CalendarItem | null {
  const base = {
    id: `${row.reservation_id}:${row.occurrence_start_time}`,
    startMs: Number(row.occurrence_start_time),
    endMs: Number(row.occurrence_end_time),
    allDay: false,
    spaceId: row.space_id ?? undefined,
    spaceName: row.space_name ?? undefined,
  };
  // Un evento cancelado borra sus reservas; si quedara alguna, no se muestra.
  if (!e || e.deletedAt != null) return null;
  const isPublic = e.status === "PUBLISHED";
  if (viewer.kind === "user" && !isPublic) {
    // No se anuncia: no se muestra. (El calendario del espacio sí lo marca como ocupado.)
    return null;
  }
  const open = isPublic && registrationOpen(e, now);
  return {
    ...base,
    kind: "event",
    title: e.name,
    description: e.summary?.trim() || undefined,
    imageUrl: e.imageUrl ?? undefined,
    eventId: e.id,
    eventStatus: viewer.kind === "admin" ? e.status : undefined,
    registrationOpen: open,
    href: isPublic
      ? open && e.form
        ? `/forms/${e.form.slug}`
        : `/events/${e.id}`
      : viewer.kind === "admin"
        ? `/admin/events/${e.id}`
        : undefined,
  };
}

export type CalendarViewer =
  | { kind: "admin"; spaceId?: string }
  | { kind: "user"; registeredUserId: string };

export async function getActivityCalendar(
  fromMs: number,
  toMs: number,
  viewer: CalendarViewer,
): Promise<ActivityCalendarData> {
  const now = nowMs();
  const spaceId = viewer.kind === "admin" ? viewer.spaceId : undefined;
  const [rows, closures, windows] = await Promise.all([
    loadOccurrences(
      fromMs,
      toMs,
      spaceId,
      viewer.kind === "user" ? viewer.registeredUserId : undefined,
    ),
    getActiveClosuresForWindow(fromMs, toMs),
    viewer.kind === "admin"
      ? prisma.maintenanceWindow.findMany({
          where: {
            OR: [{ endedAt: null }, { endedAt: { gte: BigInt(fromMs) } }],
          },
        })
      : Promise.resolve([]),
  ]);
  const events = await loadEvents([
    ...new Set(
      rows
        .filter((r) => r.reservable_type === "EVENT")
        .map((r) => r.reservable_id),
    ),
  ]);

  const items: CalendarItem[] = [];
  for (const r of rows) {
    if (r.reservable_type === "EVENT") {
      const item = eventItem(r, events.get(r.reservable_id), viewer, now);
      if (!item) continue;
      items.push(item);
      continue;
    }
    const startMs = Number(r.occurrence_start_time);
    const endMs = Number(r.occurrence_end_time);
    const own =
      viewer.kind === "user" &&
      r.reservable_type === "USER" &&
      r.reservable_id === viewer.registeredUserId;
    // Defensa en profundidad: la consulta ya filtra, pero una reserva ajena nunca sale.
    if (viewer.kind === "user" && !own) continue;
    items.push({
      id: `${r.reservation_id}:${r.occurrence_start_time}`,
      kind: "reservation",
      startMs,
      endMs,
      allDay: false,
      // Las reservas anteriores al título lo toman de su motivo.
      title: r.title || r.reason,
      description: r.reason.trim() || undefined,
      spaceId: r.space_id ?? undefined,
      spaceName: r.space_name ?? undefined,
      status: r.status,
      own: own || undefined,
      requester:
        viewer.kind === "admin" ? (r.requester ?? undefined) : undefined,
      // Para los chips de ocupación del admin (milestone 35): nunca viajan al usuario.
      actorSize: viewer.kind === "admin" ? Number(r.actor_size) : undefined,
      capacity:
        viewer.kind === "admin" ? (r.space_capacity ?? undefined) : undefined,
    });
  }

  items.push(...closureItems(closures, fromMs, toMs));
  if (viewer.kind === "admin") {
    items.push(
      ...maintenanceItems(
        windows.map((w) => ({
          id: w.id,
          title: w.title,
          mode: w.mode,
          startsAt: w.startsAt == null ? null : Number(w.startsAt),
          endsAt: w.endsAt == null ? null : Number(w.endsAt),
          endedAt: w.endedAt == null ? null : Number(w.endedAt),
          createdAt: Number(w.createdAt),
        })),
        fromMs,
        toMs,
        now,
      ),
    );
  }
  items.sort((a, b) => a.startMs - b.startMs);
  return { from: fromMs, to: toMs, items };
}
