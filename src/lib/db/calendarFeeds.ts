import "server-only";
import {
  addDaysToDateKey,
  dateKeyFromUnixMs,
} from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { SPOT_HOLDING_STATUSES } from "@/lib/constants/participants";
import { getActivityCalendar } from "@/lib/db/activityCalendar";
import { toRawReservation } from "@/lib/db/events";
import type { CalendarItem } from "@/lib/calendar/activity";
import { buildIcs, type IcsEvent } from "@/lib/calendar/ics";
import { expandAllEventOccurrences } from "@/lib/events/occurrences";
import { isEventPubliclyListed } from "@/lib/events/visibility";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo/metadata";
import { ParticipantStatus } from "@/types/prisma";

/**
 * Contenido de las suscripciones de calendario (milestone 45). Cada feed es un calendario aparte
 * en Google/Apple/Outlook, con su color y su interruptor:
 *
 * - «Mis reservas»: las propias, pendientes (marcadas) y aprobadas.
 * - «Mis eventos»: las sesiones de los eventos donde la persona tiene una inscripción vigente.
 * - «<espacio>» (admins): todo lo de ese espacio — reservas con quién reservó, eventos, cierres.
 *   Sin un «todo el edificio» (decisión del usuario): se arma activando todos los espacios.
 * - El de una inscripción (correo de confirmación): las sesiones de ese evento.
 *
 * Ventana: 30 días atrás y un año adelante. Las fechas van en UTC (ver `ics.ts`).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PAST_MS = 30 * DAY_MS;
const FUTURE_MS = 366 * DAY_MS;

/**
 * Colores (RFC 7986: nombres CSS) con su hex para Apple. Los mismos tonos que la página
 * (`occurrence-style.ts`): aprobada verde, pendiente ámbar, evento violeta, reservado azul.
 */
export const FEED_COLORS = {
  approved: { css: "green", hex: "#15803D" },
  pending: { css: "darkorange", hex: "#B45309" },
  event: { css: "rebeccapurple", hex: "#6D28D9" },
  reserved: { css: "steelblue", hex: "#2A6297" },
  closed: { css: "gray", hex: "#6B7280" },
} as const;

const PENDING_PREFIX = "⏳ Pendiente · ";

function window(now: number): [number, number] {
  return [now - PAST_MS, now + FUTURE_MS];
}

/** Un cierre de día entero, con las fechas del predio. */
function allDayRange(it: CalendarItem): IcsEvent["allDay"] {
  const start = dateKeyFromUnixMs(it.startMs);
  const last = dateKeyFromUnixMs(Math.max(it.startMs, it.endMs - 1));
  return { startDate: start, endDateExclusive: addDaysToDateKey(last, 1) };
}

function reservationEvent(it: CalendarItem, withRequester: boolean): IcsEvent {
  const pending = it.status === "PENDING";
  const description = [
    withRequester && it.requester ? `Reservó: ${it.requester}` : null,
    it.description ?? null,
    pending ? "Pendiente de aprobación." : null,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    uid: `reservation-${it.id}`,
    startMs: it.startMs,
    endMs: it.endMs,
    summary: `${pending ? PENDING_PREFIX : ""}${it.title}`,
    description: description || null,
    location: it.spaceName ?? null,
    status: pending ? "TENTATIVE" : "CONFIRMED",
    color: pending
      ? FEED_COLORS.pending.css
      : withRequester
        ? FEED_COLORS.reserved.css
        : FEED_COLORS.approved.css,
  };
}

/** «Mis reservas»: las reservas propias en la ventana. */
export async function reservationsFeedIcs(
  registeredUserId: string,
): Promise<string> {
  const now = nowMs();
  const [from, to] = window(now);
  const { items } = await getActivityCalendar(from, to, {
    kind: "user",
    registeredUserId,
  });
  return buildIcs({
    name: "La Nube — Mis reservas",
    description: "Tus reservas en La Nube. Las pendientes llevan ⏳.",
    color: FEED_COLORS.approved.css,
    appleColorHex: FEED_COLORS.approved.hex,
    nowMs: now,
    events: items
      .filter((it) => it.kind === "reservation" && it.own)
      .map((it) => reservationEvent(it, false)),
  });
}

/** Las sesiones de las inscripciones dadas (una por evento), como ítems de calendario. */
async function registrationSessions(
  registrations: {
    id: string;
    status: string;
    eventId: string;
  }[],
  now: number,
): Promise<IcsEvent[]> {
  if (registrations.length === 0) return [];
  const [from, to] = window(now);
  const eventIds = [...new Set(registrations.map((r) => r.eventId))];
  const [events, reservations] = await Promise.all([
    prisma.event.findMany({
      where: { id: { in: eventIds }, deletedAt: null },
      select: {
        id: true,
        name: true,
        summary: true,
        status: true,
        deletedAt: true,
        isPrivate: true,
        space: { select: { name: true } },
      },
    }),
    prisma.reservation.findMany({
      where: { reservableType: "EVENT", reservableId: { in: eventIds } },
      include: { exceptions: true },
    }),
  ]);
  const out: IcsEvent[] = [];
  for (const e of events) {
    const reg = registrations.find((r) => r.eventId === e.id)!;
    const pending = reg.status === ParticipantStatus.PENDING;
    const occ = expandAllEventOccurrences(
      reservations.filter((r) => r.reservableId === e.id).map(toRawReservation),
    ).filter((o) => o.endMs >= from && o.startMs <= to);
    for (const o of occ) {
      const cancelled = o.status === "cancelled";
      out.push({
        // Por el inicio **nominal**: una sesión reprogramada actualiza el mismo ítem.
        uid: `event-${e.id}-${o.occurrenceDateMs}`,
        startMs: o.startMs,
        endMs: o.endMs,
        summary: `${cancelled ? "Cancelada · " : pending ? PENDING_PREFIX : ""}${e.name}`,
        description:
          [
            e.summary,
            o.reason ? `Motivo del cambio: ${o.reason}` : null,
            pending ? "Tu inscripción está pendiente de aprobación." : null,
          ]
            .filter(Boolean)
            .join("\n") || null,
        location: e.space.name,
        url: isEventPubliclyListed(e) ? absoluteUrl(`/events/${e.id}`) : null,
        status: cancelled ? "CANCELLED" : pending ? "TENTATIVE" : "CONFIRMED",
        color: pending ? FEED_COLORS.pending.css : FEED_COLORS.event.css,
      });
    }
  }
  return out;
}

/** «Mis eventos»: sesiones de los eventos con una inscripción vigente de la persona. */
export async function eventsFeedIcs(registeredUserId: string): Promise<string> {
  const now = nowMs();
  const user = await prisma.registeredUser.findUnique({
    where: { id: registeredUserId },
    select: { user: { select: { email: true } } },
  });
  const registrations = await prisma.eventParticipant.findMany({
    where: {
      status: { in: SPOT_HOLDING_STATUSES },
      OR: [
        { userId: registeredUserId },
        ...(user?.user.email ? [{ email: user.user.email }] : []),
      ],
    },
    select: { id: true, status: true, eventId: true },
  });
  return buildIcs({
    name: "La Nube — Mis eventos",
    description:
      "Las sesiones de los eventos de La Nube en los que te inscribiste.",
    color: FEED_COLORS.event.css,
    appleColorHex: FEED_COLORS.event.hex,
    nowMs: now,
    events: await registrationSessions(registrations, now),
  });
}

/** El de una inscripción (enlace del correo de confirmación). `null` si no existe. */
export async function registrationFeedIcs(
  participantId: string,
): Promise<string | null> {
  const now = nowMs();
  const reg = await prisma.eventParticipant.findUnique({
    where: { id: participantId },
    select: {
      id: true,
      status: true,
      eventId: true,
      event: { select: { name: true } },
    },
  });
  if (!reg) return null;
  // Una inscripción cancelada o rechazada deja el calendario vacío (sigue respondiendo, así la
  // suscripción no da error y los ítems desaparecen solos).
  const active = SPOT_HOLDING_STATUSES.includes(
    reg.status as ParticipantStatus,
  );
  return buildIcs({
    name: `La Nube — ${reg.event.name}`,
    description: `Las sesiones de ${reg.event.name}. Se actualiza solo si alguna cambia.`,
    color: FEED_COLORS.event.css,
    appleColorHex: FEED_COLORS.event.hex,
    nowMs: now,
    events: active ? await registrationSessions([reg], now) : [],
  });
}

/** «<espacio>» (admins): todo lo que pasa en un espacio. `null` si el espacio no existe. */
export async function spaceFeedIcs(spaceId: string): Promise<string | null> {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { id: true, name: true, kind: true },
  });
  if (!space || space.kind !== "SPACE") return null;
  const now = nowMs();
  const [from, to] = window(now);
  const { items } = await getActivityCalendar(from, to, {
    kind: "admin",
    spaceId,
  });
  const events: IcsEvent[] = [];
  for (const it of items) {
    if (it.kind === "reservation") {
      events.push(reservationEvent(it, true));
    } else if (it.kind === "event") {
      const draft = it.eventStatus && it.eventStatus !== "PUBLISHED";
      events.push({
        uid: `space-event-${it.id}`,
        startMs: it.startMs,
        endMs: it.endMs,
        summary: `${draft ? "(Sin publicar) " : ""}${it.title}`,
        description: it.description ?? null,
        location: space.name,
        url: it.eventId ? absoluteUrl(`/admin/events/${it.eventId}`) : null,
        status: "CONFIRMED",
        color: FEED_COLORS.event.css,
      });
    } else if (it.kind === "closed") {
      events.push({
        uid: `closed-${it.id}`,
        startMs: it.startMs,
        endMs: it.endMs,
        allDay: it.allDay ? allDayRange(it) : undefined,
        summary: `Cerrado: ${it.title}`,
        description: it.detail ?? null,
        status: "CONFIRMED",
        color: FEED_COLORS.closed.css,
      });
    }
  }
  return buildIcs({
    name: `La Nube — ${space.name}`,
    description: `Todo lo que pasa en ${space.name}: reservas, eventos y cierres.`,
    color: FEED_COLORS.reserved.css,
    appleColorHex: FEED_COLORS.reserved.hex,
    nowMs: now,
    events,
  });
}
