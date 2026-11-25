import { now } from "@/lib/clock";
import { SPOT_HOLDING_STATUSES } from "@/lib/constants/participants";
import { OPEN_END_MS } from "@/lib/db/occurrences";
import { prisma } from "@/lib/prisma";
import { dateToUnixMs } from "@/lib/unix-ms";

/**
 * Lo que el tablero del usuario lista (milestone 35): sus reservas próximas, su historial y las
 * próximas sesiones de los eventos en los que está inscripto. Todo **por ocurrencia**, con la
 * misma expansión que los reportes y el calendario (`reservation_occurrences()`, milestone 25).
 */

/** Una ocurrencia de una reserva propia. */
export interface UserReservationItem {
  /** Único por ocurrencia (una serie semanal aporta una fila por semana). */
  id: string;
  reservationId: string;
  startTime: number;
  endTime: number;
  status: string;
  title: string;
  /** La descripción (la columna `reason`). */
  reason: string | null;
  deniedReason: string | null;
  isRecurring: boolean;
  spaceName: string | null;
}

export interface UserReservationsPage {
  items: UserReservationItem[];
  page: number;
  pageSize: number;
  total: number;
}

export const USER_RESERVATIONS_PAGE_SIZE = 10;

interface Row {
  reservation_id: string;
  occurrence_start_time: bigint;
  occurrence_end_time: bigint;
  status: string;
  title: string;
  reason: string;
  denied_reason: string | null;
  is_recurring: boolean;
  space_name: string | null;
  total: number;
}

/**
 * Reservas propias, paginadas.
 *
 * - `upcoming`: las que todavía no terminaron (una en curso cuenta), pendientes o aprobadas —
 *   una rechazada o cancelada no «viene» —, de la más próxima a la más lejana.
 * - `past`: las que ya terminaron, **de cualquier estado** (es el historial: rechazadas y
 *   canceladas también cuentan lo que pasó), de la más reciente a la más antigua.
 */
export async function listUserReservations(
  registeredUserId: string,
  when: "upcoming" | "past",
  page: number,
  pageSize = USER_RESERVATIONS_PAGE_SIZE,
): Promise<UserReservationsPage> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const atMs = BigInt(dateToUnixMs(now()));
  const offset = (safePage - 1) * pageSize;

  const rows =
    when === "upcoming"
      ? await prisma.$queryRaw<Row[]>`
          SELECT o.reservation_id, o.occurrence_start_time, o.occurrence_end_time,
                 r.status::text AS status, r.title, r.reason, r.denied_reason,
                 r.is_recurring, s.name AS space_name,
                 COUNT(*) OVER ()::int AS total
          FROM reservation_occurrences(0, ${BigInt(OPEN_END_MS)}, 'USER'::reservable_types, ${registeredUserId}::text) o
          JOIN reservations r ON r.id = o.reservation_id
          LEFT JOIN spaces s ON s.id = r.space_id
          WHERE o.occurrence_end_time >= ${atMs}
            AND r.status IN ('PENDING', 'APPROVED')
          ORDER BY o.occurrence_start_time ASC
          LIMIT ${pageSize} OFFSET ${offset}`
      : await prisma.$queryRaw<Row[]>`
          SELECT o.reservation_id, o.occurrence_start_time, o.occurrence_end_time,
                 r.status::text AS status, r.title, r.reason, r.denied_reason,
                 r.is_recurring, s.name AS space_name,
                 COUNT(*) OVER ()::int AS total
          FROM reservation_occurrences(0, ${BigInt(OPEN_END_MS)}, 'USER'::reservable_types, ${registeredUserId}::text) o
          JOIN reservations r ON r.id = o.reservation_id
          LEFT JOIN spaces s ON s.id = r.space_id
          WHERE o.occurrence_end_time < ${atMs}
          ORDER BY o.occurrence_start_time DESC
          LIMIT ${pageSize} OFFSET ${offset}`;

  return {
    page: safePage,
    pageSize,
    total: rows[0]?.total ?? 0,
    items: rows.map((r) => ({
      id: `${r.reservation_id}:${r.occurrence_start_time}`,
      reservationId: r.reservation_id,
      startTime: Number(r.occurrence_start_time),
      endTime: Number(r.occurrence_end_time),
      status: r.status,
      // Las reservas anteriores al título lo toman de su motivo.
      title: r.title || r.reason,
      reason: r.reason || null,
      deniedReason: r.denied_reason,
      isRecurring: r.is_recurring,
      spaceName: r.space_name,
    })),
  };
}

/** Una sesión próxima de un evento al que la persona está inscripta. */
export interface UserEventSession {
  id: string;
  eventId: string;
  name: string;
  startTime: number;
  endTime: number;
  spaceName: string | null;
  /** `PENDING` (a la espera del equipo) o `APPROVED`. */
  participantStatus: string;
}

interface SessionRow {
  event_id: string;
  name: string;
  space_name: string | null;
  participant_status: string;
  occurrence_start_time: bigint;
  occurrence_end_time: bigint;
}

/**
 * Los eventos en los que la persona tiene un lugar (pendiente o aprobado; rechazadas y
 * canceladas no cuentan, por correo normalizado — la clave de una inscripción), **cada uno con
 * su próxima sesión y nada más** (milestone 35): un evento semanal con veinte sesiones es una
 * sola fila, no veinte. Una sesión cancelada ya viene omitida por la expansión; un evento sin
 * sesiones por delante no aparece. De la más próxima a la más lejana.
 */
export async function listUserUpcomingEventSessions(
  normalizedEmail: string,
  limit = 50,
): Promise<UserEventSession[]> {
  const atMs = BigInt(dateToUnixMs(now()));
  const rows = await prisma.$queryRaw<SessionRow[]>`
    SELECT * FROM (
      SELECT DISTINCT ON (e.id)
             e.id AS event_id, e.name, s.name AS space_name,
             p.status::text AS participant_status,
             o.occurrence_start_time, o.occurrence_end_time
      FROM event_participants p
      JOIN events e ON e.id = p.event_id AND e.deleted_at IS NULL
      LEFT JOIN spaces s ON s.id = e.space_id
      CROSS JOIN LATERAL reservation_occurrences(
        ${atMs}, ${BigInt(OPEN_END_MS)}, 'EVENT'::reservable_types, e.id
      ) o
      WHERE p.email = ${normalizedEmail}
        AND p.status IN ('PENDING', 'APPROVED')
      ORDER BY e.id, o.occurrence_start_time ASC
    ) next
    ORDER BY occurrence_start_time ASC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    id: `${r.event_id}:${r.occurrence_start_time}`,
    eventId: r.event_id,
    name: r.name,
    startTime: Number(r.occurrence_start_time),
    endTime: Number(r.occurrence_end_time),
    spaceName: r.space_name,
    participantStatus: r.participant_status,
  }));
}

/** Un evento al que la persona se puede inscribir ahora (o ir sin inscripción). */
export interface AvailableEvent {
  id: string;
  name: string;
  summary: string | null;
  spaceName: string;
  /** Próxima sesión. */
  startTime: number;
  endTime: number;
  /**
   * `open`: hay formulario abierto y cupo; `upcoming`: la inscripción todavía no abrió (ver
   * `opensAt`); `none`: no pide inscripción.
   */
  registration: "open" | "upcoming" | "none";
  /** Solo `upcoming`: cuándo abre la inscripción (ms UTC). */
  opensAt: number | null;
  /** Si hay formulario abierto, su enlace; si no, la página del evento. */
  formSlug: string | null;
}

/**
 * «Eventos disponibles» (milestone 35): eventos publicados que no terminaron, en los que la
 * persona **no** tiene lugar, y a los que se puede ir: o no piden inscripción (sin formulario),
 * o su inscripción está abierta y queda cupo, o **todavía no abrió** (se muestra con su fecha de
 * apertura). Se omiten los de inscripción cerrada o completa y los que la persona ya tiene o le
 * rechazaron (rechazada no puede volver a inscribirse). Del más próximo al más lejano.
 */
export async function listAvailableEvents(
  normalizedEmail: string,
  limit = 30,
): Promise<AvailableEvent[]> {
  const nowNum = Number(dateToUnixMs(now()));
  const nowBig = BigInt(nowNum);
  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      // Privados (milestone 43): solo si esta persona está en su lista de invitados.
      AND: [
        {
          OR: [
            { isPrivate: false },
            { invitees: { some: { email: normalizedEmail } } },
          ],
        },
      ],
      OR: [
        { recurrenceEnd: { gte: nowBig } },
        { recurrenceEnd: null, endTime: { gte: nowBig } },
      ],
      NOT: {
        participants: {
          some: { email: normalizedEmail, status: { not: "CANCELLED" } },
        },
      },
    },
    select: {
      id: true,
      name: true,
      summary: true,
      capacity: true,
      space: { select: { name: true, capacity: true } },
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

  type Candidate = {
    e: (typeof events)[number];
    registration: "open" | "upcoming" | "none";
  };
  const candidates = events.flatMap<Candidate>((e) => {
    if (!e.form) return [{ e, registration: "none" as const }];
    const cap = e.capacity ?? e.space.capacity ?? null;
    const full = cap !== null && e._count.participants >= cap;
    // Un formulario sin publicar no existe para el público; uno completo o vencido, tampoco.
    if (!e.form.isPublished || full || nowNum > Number(e.form.closesAt))
      return [];
    return [
      {
        e,
        registration:
          Number(e.form.opensAt) <= nowNum ? "open" : ("upcoming" as const),
      },
    ];
  });
  if (candidates.length === 0) return [];

  const ids = candidates.map((c) => c.e.id);
  const next = await prisma.$queryRaw<
    {
      event_id: string;
      occurrence_start_time: bigint;
      occurrence_end_time: bigint;
    }[]
  >`
    SELECT DISTINCT ON (e.id) e.id AS event_id,
           o.occurrence_start_time, o.occurrence_end_time
    FROM events e
    CROSS JOIN LATERAL reservation_occurrences(
      ${nowBig}, ${BigInt(OPEN_END_MS)}, 'EVENT'::reservable_types, e.id
    ) o
    WHERE e.id = ANY(${ids}::text[])
    ORDER BY e.id, o.occurrence_start_time ASC`;
  const nextById = new Map(next.map((n) => [n.event_id, n]));

  return candidates
    .flatMap(({ e, registration }) => {
      const n = nextById.get(e.id);
      // Sin ninguna sesión por delante (todas canceladas): no hay a qué ir.
      if (!n) return [];
      return [
        {
          id: e.id,
          name: e.name,
          summary: e.summary,
          spaceName: e.space.name,
          startTime: Number(n.occurrence_start_time),
          endTime: Number(n.occurrence_end_time),
          registration,
          opensAt:
            registration === "upcoming" && e.form
              ? Number(e.form.opensAt)
              : null,
          formSlug: registration === "open" ? (e.form?.slug ?? null) : null,
        } satisfies AvailableEvent,
      ];
    })
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, limit);
}

/** Un evento ya terminado en el que la persona tenía (o pidió) un lugar. */
export interface PastUserEvent {
  id: string;
  name: string;
  spaceName: string | null;
  startTime: number;
  /** Cuándo terminó: el fin de la recurrencia o, si no repite, el fin del evento. */
  endedAt: number;
  /** Estado de su inscripción (`APPROVED`, `PENDING`, `REJECTED`, `CANCELLED`). */
  participantStatus: string;
}

export interface PastUserEventsPage {
  items: PastUserEvent[];
  page: number;
  pageSize: number;
  total: number;
}

interface PastRow {
  event_id: string;
  name: string;
  space_name: string | null;
  start_time: bigint;
  ended_at: bigint;
  participant_status: string;
  total: number;
}

/**
 * «Eventos pasados» (milestone 35): el historial completo, paginado y por evento, de los eventos
 * ya terminados en los que la persona se inscribió (cualquier estado de inscripción, como el
 * historial de reservas). «Terminado» es la misma regla que `eventDisplayStatus`: el fin de la
 * recurrencia, o el fin del evento si no repite. Del más reciente al más antiguo.
 */
export async function listUserPastEvents(
  normalizedEmail: string,
  page: number,
  pageSize = USER_RESERVATIONS_PAGE_SIZE,
): Promise<PastUserEventsPage> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const atMs = BigInt(dateToUnixMs(now()));
  const rows = await prisma.$queryRaw<PastRow[]>`
    SELECT e.id AS event_id, e.name, s.name AS space_name, e.start_time,
           COALESCE(e.recurrence_end, e.end_time) AS ended_at,
           p.status::text AS participant_status,
           COUNT(*) OVER ()::int AS total
    FROM event_participants p
    JOIN events e ON e.id = p.event_id AND e.deleted_at IS NULL
    LEFT JOIN spaces s ON s.id = e.space_id
    WHERE p.email = ${normalizedEmail}
      AND COALESCE(e.recurrence_end, e.end_time) < ${atMs}
    ORDER BY ended_at DESC
    LIMIT ${pageSize} OFFSET ${(safePage - 1) * pageSize}`;
  return {
    page: safePage,
    pageSize,
    total: rows[0]?.total ?? 0,
    items: rows.map((r) => ({
      id: r.event_id,
      name: r.name,
      spaceName: r.space_name,
      startTime: Number(r.start_time),
      endedAt: Number(r.ended_at),
      participantStatus: r.participant_status,
    })),
  };
}
