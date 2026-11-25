import { isEventPubliclyListed } from "@/lib/events/visibility";
import {
  getUnavailableSlots,
  getUserReservationsInWindow,
} from "@/lib/db/reservations";
import { nowMs } from "@/lib/clock";
import { closureSlotsForRange } from "@/lib/closed-days/closures";
import { getActiveClosuresForWindow } from "@/lib/db/closedDays";
import { SPOT_HOLDING_STATUSES } from "@/lib/constants/participants";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import { prisma } from "@/lib/prisma";
import { dateToUnixMs } from "@/lib/unix-ms";
import { ReservableType } from "@/generated/prisma/client";

export interface ReservationOccurrence {
  reservationId: string;
  occurrenceStartTime: number;
  occurrenceEndTime: number;
  /**
   * Lo que se lee en la tarjeta del calendario (milestone 35): el título de la reserva o el
   * nombre del evento (o «Reservado para un evento» si no está publicado).
   */
  title: string;
  /** La descripción de la reserva (la columna `reason`); "" si no tiene y en los eventos. */
  reason: string;
  status: string;
  reservableType: string;
  reservableId: string;
  /** Present for EVENT occurrences: the owning event. */
  eventId?: string;
  /** Eventos públicos: el copete y la portada, para el detalle del calendario. */
  eventSummary?: string | null;
  eventImageUrl?: string | null;
  /** Public form slug, if the event has a form. */
  formSlug?: string | null;
  /** Whether the form is currently published, within its window, and not full. */
  formOpen?: boolean;
  /**
   * Solo en ocurrencias de eventos: si el evento es público (publicado y no cancelado), es
   * decir si tiene página en `/events/[id]` (milestone 29). Las reservas de un evento nacen
   * aprobadas también en borrador o pausado: bloquean el espacio igual, pero el calendario no
   * muestra su nombre ni enlaces hasta que se publica.
   */
  eventPublic?: boolean;
  /** Whether this occurrence belongs to a recurring reservation (drives the cancel-scope prompt). */
  isRecurring?: boolean;
}

/** Why a time slot is unavailable. Extend this union for new blocking reasons. */
export type UnavailableSlotKind =
  | "resource_full"
  | "cross_resource"
  /** Día cerrado (milestone 23): el espacio no atiende; lleva el motivo en `title`. */
  | "closed";

export interface CalendarUnavailableSlot {
  spaceId: string;
  startTime: number;
  endTime: number;
  kind: UnavailableSlotKind;
  /** Solo `closed`: el motivo del cierre, para mostrarlo en el calendario. */
  title?: string;
}

/** Returns the RegisteredUser ID for a given account email, or null. */
export async function getRegisteredUserIdByEmail(
  email: string,
): Promise<string | null> {
  email = await normalizeEmailForIdentityServer(email);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { registeredUser: true },
  });
  return user?.registeredUser?.id ?? null;
}

/** Lo que muestra el calendario en lugar del nombre de un evento no publicado. */
export const UNPUBLISHED_EVENT_LABEL = "Reservado para un evento";

interface EventOccurrenceRow {
  reservation_id: string;
  event_id: string;
  space_id: string;
  occurrence_start_time: bigint;
  occurrence_end_time: bigint;
  reason: string | null;
}

/**
 * APPROVED EVENT occurrences for a space in a window. These render on the calendar
 * as named, read-only cards (with a form link) rather than anonymous unavailable blocks.
 */
export async function getEventOccurrencesForSpace(
  spaceId: string,
  startDate: Date,
  endDate: Date,
): Promise<ReservationOccurrence[]> {
  const rangeStartMs = dateToUnixMs(startDate);
  const rangeEndMs = dateToUnixMs(endDate);

  const rows = await prisma.$queryRaw<EventOccurrenceRow[]>`
    SELECT l.reservation_id, l.reservable_id AS event_id, l.space_id,
           l.occurrence_start_time, l.occurrence_end_time, l.reason
    FROM reservation_ledger l
    WHERE l.reservable_type = 'EVENT'
      AND l.status = 'APPROVED'
      AND l.space_id = ${spaceId}
      AND l.occurrence_start_time < ${rangeEndMs}::bigint
      AND l.occurrence_end_time > ${rangeStartMs}::bigint
  `;
  if (rows.length === 0) return [];

  const eventIds = [...new Set(rows.map((r) => r.event_id))];
  const events = await prisma.event.findMany({
    where: { id: { in: eventIds } },
    select: {
      id: true,
      name: true,
      summary: true,
      imageUrl: true,
      status: true,
      deletedAt: true,
      isPrivate: true,
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

  const now = nowMs();
  const meta = new Map(
    events.map((e) => {
      const cap = e.capacity ?? e.space.capacity;
      const isFull = cap !== null && e._count.participants >= cap;
      const formOpen = Boolean(
        e.form?.isPublished &&
        Number(e.form.opensAt) <= now &&
        now <= Number(e.form.closesAt) &&
        !isFull,
      );
      // Privado (milestone 43) = como no publicado: ocupa el horario sin nombre ni enlaces.
      const isPublic = isEventPubliclyListed(e);
      return [
        e.id,
        // Un evento no publicado no expone nombre ni enlaces (milestone 29): su página daría
        // 404 y el nombre puede ser de algo que todavía no se anunció.
        isPublic
          ? {
              name: e.name,
              summary: e.summary,
              imageUrl: e.imageUrl,
              formSlug: e.form?.slug ?? null,
              formOpen,
              isPublic,
            }
          : {
              name: UNPUBLISHED_EVENT_LABEL,
              summary: null,
              imageUrl: null,
              formSlug: null,
              formOpen: false,
              isPublic,
            },
      ];
    }),
  );

  // Merge adjacent 15-min ledger buckets back into full occurrence spans.
  const byReservation = new Map<string, EventOccurrenceRow[]>();
  for (const r of rows) {
    const list = byReservation.get(r.reservation_id);
    if (list) list.push(r);
    else byReservation.set(r.reservation_id, [r]);
  }

  const occurrences: ReservationOccurrence[] = [];
  for (const [reservationId, group] of byReservation) {
    group.sort((a, b) =>
      Number(a.occurrence_start_time - b.occurrence_start_time),
    );
    const m = meta.get(group[0].event_id);
    const base = {
      reservationId,
      title: m?.name ?? UNPUBLISHED_EVENT_LABEL,
      reason: "",
      eventSummary: m?.summary ?? null,
      eventImageUrl: m?.imageUrl ?? null,
      status: "APPROVED",
      reservableType: "EVENT",
      reservableId: group[0].event_id,
      eventId: group[0].event_id,
      formSlug: m?.formSlug ?? null,
      formOpen: m?.formOpen ?? false,
      eventPublic: m?.isPublic ?? false,
    };

    let spanStart = Number(group[0].occurrence_start_time);
    let spanEnd = Number(group[0].occurrence_end_time);
    for (let i = 1; i < group.length; i++) {
      const s = Number(group[i].occurrence_start_time);
      const e = Number(group[i].occurrence_end_time);
      if (s <= spanEnd) {
        if (e > spanEnd) spanEnd = e;
      } else {
        occurrences.push({
          ...base,
          occurrenceStartTime: spanStart,
          occurrenceEndTime: spanEnd,
        });
        spanStart = s;
        spanEnd = e;
      }
    }
    occurrences.push({
      ...base,
      occurrenceStartTime: spanStart,
      occurrenceEndTime: spanEnd,
    });
  }

  return occurrences;
}

/** Fetches calendar data: unavailable slots (by other users) and user's own reservations. */
export async function getCalendarDataBySpace(
  spaceId: string,
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<{
  unavailableSlots: CalendarUnavailableSlot[];
  userReservations: ReservationOccurrence[];
}> {
  const rangeStartMs = dateToUnixMs(startDate);
  const rangeEndMs = dateToUnixMs(endDate);

  const [unavailableSlotsRaw, allUserReservations, eventOccurrences, closures] =
    await Promise.all([
      getUnavailableSlots(spaceId, startDate, endDate, userId),
      // Solo la ventana visible, **entera**: la función SQL filtra por el inicio de cada
      // ocurrencia, así que arrancar la ventana en «ahora» hacía desaparecer una reserva en
      // curso (de 15:15 a 17:00, a las 15:25) y las de hoy que ya pasaron. Antes se pedían las
      // próximas 500 y se filtraba acá: costaba lo mismo para cualquier semana y el techo se
      // agotaba con muchas recurrentes (milestone 25, DB5).
      getUserReservationsInWindow(
        userId,
        Number(rangeStartMs),
        Number(rangeEndMs),
      ),
      getEventOccurrencesForSpace(spaceId, startDate, endDate),
      // Días cerrados (milestone 23): del espacio entero, así que no dependen de `spaceId`.
      getActiveClosuresForWindow(Number(rangeStartMs), Number(rangeEndMs)),
    ]);

  // Una sola lectura trae si cada reserva es recurrente y su título (milestone 35): las
  // funciones SQL que arman `allUserReservations` no lo devuelven.
  const reservationMeta = new Map(
    (
      await prisma.reservation.findMany({
        where: {
          id: {
            in: [...new Set(allUserReservations.map((r) => r.reservationId))],
          },
        },
        select: { id: true, isRecurring: true, title: true },
      })
    ).map((r) => [r.id, r]),
  );

  const userReservations: ReservationOccurrence[] = [];
  const crossResourceSlots: CalendarUnavailableSlot[] = [];

  for (const res of allUserReservations) {
    const ms = Number(res.occurrenceStartTime);
    if (ms < rangeStartMs || ms > rangeEndMs) continue;

    if (res.spaceId === spaceId) {
      userReservations.push({
        // `res.id` is a synthetic per-occurrence id for recurring reservations
        // (`"<reservationId>_<occurrenceStart>"`, from get_user_next_reservations) —
        // `res.reservationId` is always the real Reservation.id needed to act on it.
        reservationId: res.reservationId,
        occurrenceStartTime: Number(res.occurrenceStartTime),
        occurrenceEndTime: Number(res.occurrenceEndTime),
        // Las reservas anteriores al título lo toman de su motivo.
        title:
          reservationMeta.get(res.reservationId)?.title || res.reason || "",
        reason: res.reason ?? "",
        status: res.status,
        reservableType: res.reservableType as ReservableType,
        reservableId: res.reservableId,
        isRecurring:
          reservationMeta.get(res.reservationId)?.isRecurring ?? false,
      });
    } else if (
      res.spaceId != null &&
      (res.status === "PENDING" || res.status === "APPROVED")
    ) {
      crossResourceSlots.push({
        spaceId: res.spaceId,
        startTime: Number(res.occurrenceStartTime),
        endTime: Number(res.occurrenceEndTime),
        kind: "cross_resource",
      });
    }
  }

  // Event occurrences fully block their space — get_unavailable_slots reports them too.
  // Drop the anonymous blocks so each event renders once as its named card.
  const resourceFullSlots = unavailableSlotsRaw
    .map((s) => ({
      spaceId: s.spaceId,
      startTime: Number(s.startTime),
      endTime: Number(s.endTime),
      kind: "resource_full" as UnavailableSlotKind,
    }))
    .filter(
      (slot) =>
        !eventOccurrences.some(
          (ev) =>
            ev.occurrenceStartTime < slot.endTime &&
            ev.occurrenceEndTime > slot.startTime,
        ),
    );

  // Cada cierre se dibuja con su motivo; el cliente los bloquea como cualquier otro tramo no
  // disponible. Ya vienen expandidos por día y recortados al horario de reserva.
  const closedSlots: CalendarUnavailableSlot[] = closureSlotsForRange(
    closures,
    Number(rangeStartMs),
    Number(rangeEndMs),
  ).map((c) => ({
    spaceId,
    startTime: c.startTime,
    endTime: c.endTime,
    kind: "closed" as const,
    title: c.title,
  }));

  return {
    unavailableSlots: [
      ...resourceFullSlots,
      ...crossResourceSlots,
      ...closedSlots,
    ],
    userReservations: [...userReservations, ...eventOccurrences],
  };
}
