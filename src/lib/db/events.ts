import { ADMIN_TIMEZONE, dateKeyFromUnixMs } from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { bindFormToEvent, unbindFormFromEvent } from "@/lib/db/forms";
import { dateTimeLocalToMs, msToDateTimeLocal } from "@/lib/events/datetime";
import { OccurrencePlan, planEventOccurrences } from "@/lib/events/plan";
import { prisma } from "@/lib/prisma";
import { EventInput, WEEKDAY_RRULE } from "@/lib/schemas/events";
import { createId } from "@paralleldrive/cuid2";
import { TZDate } from "@date-fns/tz";
import { Event, EventType, Prisma } from "@/generated/prisma/client";

export { planEventOccurrences } from "@/lib/events/plan";

async function getResourceCapacity(
  tx: Prisma.TransactionClient,
  resourceId: string,
): Promise<number | null> {
  const resource = await tx.resource.findUnique({
    where: { id: resourceId },
    include: { fungibleResource: { select: { capacity: true } } },
  });
  if (!resource) return null;
  return resource.fungibleResource?.capacity ?? 1;
}

async function insertEventReservations(
  tx: Prisma.TransactionClient,
  eventId: string,
  eventType: EventType,
  reason: string,
  plans: OccurrencePlan[],
  resourceId: string,
): Promise<void> {
  for (const p of plans) {
    await tx.$executeRaw`
      SELECT create_event_reservation(
        ${p.reservationId}::text,
        ${eventId}::text,
        ${resourceId}::text,
        ${eventType}::event_types,
        ${reason}::text,
        ${p.startMs}::bigint,
        ${p.endMs}::bigint,
        true::boolean,
        ${p.rrule}::text,
        ${p.recurrenceEndMs}::bigint
      )
    `;
  }
}

async function deleteEventReservations(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<void> {
  await tx.$executeRaw`
    DELETE FROM reservation_ledger
    WHERE reservation_id IN (
      SELECT id FROM reservations
      WHERE reservable_type = 'EVENT' AND reservable_id = ${eventId}
    )
  `;
  await tx.reservation.deleteMany({
    where: { reservableType: "EVENT", reservableId: eventId },
  });
}

function translateSqlError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.includes("already booked")) {
      throw new Error(
        "El recurso ya está reservado en alguno de los horarios del evento",
      );
    }
    if (error.message.includes("not found")) {
      throw new Error("El recurso seleccionado no existe");
    }
  }
  throw error instanceof Error ? error : new Error("Error desconocido");
}

export async function createEvent(input: EventInput): Promise<Event> {
  const plans = planEventOccurrences(input);
  if (plans.length === 0) {
    throw new Error(
      "El rango de fechas no contiene ninguno de los días elegidos",
    );
  }

  const eventId = createId();
  const earliest = plans.reduce((a, b) => (a.startMs <= b.startMs ? a : b));
  const byDay = input.weekdays.map((w) => WEEKDAY_RRULE[w]).join(",");

  try {
    return await prisma.$transaction(async (tx) => {
      const capacity =
        input.capacity ?? (await getResourceCapacity(tx, input.resourceId));
      if (capacity === null) {
        throw new Error("El recurso seleccionado no existe");
      }

      const event = await tx.event.create({
        data: {
          id: eventId,
          name: input.name,
          description: input.description ?? null,
          eventType: input.eventType,
          status: input.status,
          resourceId: input.resourceId,
          startTime: earliest.startMs,
          endTime: earliest.endMs,
          rrule: `FREQ=WEEKLY;BYDAY=${byDay}`,
          recurrenceEnd: earliest.recurrenceEndMs,
          capacity: input.capacity ?? null,
          imageUrl: input.imageUrl ?? null,
        },
      });

      await insertEventReservations(
        tx,
        eventId,
        input.eventType,
        input.name,
        plans,
        input.resourceId,
      );

      if (input.form) {
        await bindFormToEvent(
          tx,
          eventId,
          input.form,
          input.status === "PUBLISHED",
        );
      }

      return event;
    });
  } catch (error) {
    translateSqlError(error);
  }
}

/**
 * Reconciles an event's form binding against the submitted input. Re-clones only when the
 * template changes (which orphans participants' answers, so it's blocked once anyone has
 * registered); otherwise just updates the registration window + publish state in place,
 * keeping the field snapshot and public slug stable.
 */
async function syncEventForm(
  tx: Prisma.TransactionClient,
  eventId: string,
  input: EventInput,
): Promise<void> {
  const existing = await tx.eventForm.findUnique({ where: { eventId } });
  const binding = input.form;
  // The form row mirrors the event's published state.
  const isPublished = input.status === "PUBLISHED";

  if (!binding) {
    if (existing) {
      const participants = await tx.eventParticipant.count({
        where: { eventId },
      });
      if (participants > 0) {
        throw new Error(
          "No se puede quitar el formulario de un evento con inscriptos",
        );
      }
      await unbindFormFromEvent(tx, existing.formId);
    }
    return;
  }

  if (!existing) {
    await bindFormToEvent(tx, eventId, binding, isPublished);
    return;
  }

  if (existing.templateId !== binding.templateId) {
    const participants = await tx.eventParticipant.count({
      where: { eventId },
    });
    if (participants > 0) {
      throw new Error(
        "No se puede cambiar el formulario de un evento con inscriptos",
      );
    }
    await unbindFormFromEvent(tx, existing.formId);
    await bindFormToEvent(tx, eventId, binding, isPublished);
    return;
  }

  await tx.eventForm.update({
    where: { eventId },
    data: {
      opensAt: dateTimeLocalToMs(binding.opensAt),
      closesAt: dateTimeLocalToMs(binding.closesAt),
      isPublished,
    },
  });
}

export async function updateEvent(
  id: string,
  input: EventInput,
): Promise<Event> {
  const plans = planEventOccurrences(input);
  if (plans.length === 0) {
    throw new Error(
      "El rango de fechas no contiene ninguno de los días elegidos",
    );
  }

  const earliest = plans.reduce((a, b) => (a.startMs <= b.startMs ? a : b));
  const byDay = input.weekdays.map((w) => WEEKDAY_RRULE[w]).join(",");

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.event.findUnique({ where: { id } });
      if (!existing) {
        throw new Error("Evento no encontrado");
      }

      const capacity =
        input.capacity ?? (await getResourceCapacity(tx, input.resourceId));
      if (capacity === null) {
        throw new Error("El recurso seleccionado no existe");
      }

      // Reservations are reconstructed from scratch (dates/cadence/resource may change).
      await deleteEventReservations(tx, id);

      const event = await tx.event.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description ?? null,
          eventType: input.eventType,
          status: input.status,
          resourceId: input.resourceId,
          startTime: earliest.startMs,
          endTime: earliest.endMs,
          rrule: `FREQ=WEEKLY;BYDAY=${byDay}`,
          recurrenceEnd: earliest.recurrenceEndMs,
          capacity: input.capacity ?? null,
          imageUrl: input.imageUrl ?? null,
        },
      });

      await insertEventReservations(
        tx,
        id,
        input.eventType,
        input.name,
        plans,
        input.resourceId,
      );

      await syncEventForm(tx, id, input);

      return event;
    });
  } catch (error) {
    translateSqlError(error);
  }
}

export async function deleteEvent(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.event.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Evento no encontrado");
    }
    // The instance Form isn't cascaded by the event FK, so drop it explicitly (this
    // cascades the event_forms binding). Participants cascade via the event FK.
    const form = await tx.eventForm.findUnique({
      where: { eventId: id },
      select: { formId: true },
    });
    if (form) await unbindFormFromEvent(tx, form.formId);
    await deleteEventReservations(tx, id);
    await tx.event.delete({ where: { id } });
  });
}

export async function getEvent(id: string) {
  return prisma.event.findUnique({
    where: { id },
    include: {
      resource: {
        select: { id: true, name: true, type: true },
      },
      form: {
        select: {
          id: true,
          slug: true,
          isPublished: true,
          templateId: true,
          opensAt: true,
          closesAt: true,
        },
      },
      _count: { select: { participants: true } },
    },
  });
}

/** Paginated events, newest first. Returns the page items plus the total for the controls. */
export async function listEvents({
  page = 1,
  pageSize = 9,
}: { page?: number; pageSize?: number } = {}) {
  const [events, total] = await prisma.$transaction([
    prisma.event.findMany({
      orderBy: { startTime: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        resource: { select: { id: true, name: true, type: true } },
        form: { select: { id: true, slug: true, isPublished: true } },
        _count: { select: { participants: true } },
      },
    }),
    prisma.event.count(),
  ]);
  return { events, total, page, pageSize };
}

type EventWithFormBinding = Event & {
  form?: {
    slug: string;
    templateId: string | null;
    opensAt: bigint;
    closesAt: bigint;
    isPublished: boolean;
  } | null;
};

/**
 * Reconstructs the admin form fields (date range / weekdays / time window + form binding)
 * from a stored event, for the edit screen.
 */
export function eventToFormDefaults(event: EventWithFormBinding) {
  const startKey = dateKeyFromUnixMs(Number(event.startTime));
  const endKey = event.recurrenceEnd
    ? dateKeyFromUnixMs(Number(event.recurrenceEnd))
    : startKey;
  const start = new TZDate(Number(event.startTime), ADMIN_TIMEZONE);
  const end = new TZDate(Number(event.endTime), ADMIN_TIMEZONE);
  const pad = (n: number) => String(n).padStart(2, "0");

  const weekdays = weekdaysFromRrule(event.rrule);

  return {
    name: event.name,
    description: event.description ?? "",
    eventType: event.eventType,
    status: event.status,
    resourceId: event.resourceId,
    startDate: startKey,
    endDate: endKey,
    weekdays,
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    capacity: event.capacity,
    imageUrl: event.imageUrl ?? null,
    form: event.form
      ? {
          templateId: event.form.templateId ?? "",
          slug: event.form.slug,
          opensAt: msToDateTimeLocal(Number(event.form.opensAt)),
          closesAt: msToDateTimeLocal(Number(event.form.closesAt)),
        }
      : null,
  };
}

/** Weekday numbers (0 = Sun .. 6 = Sat) parsed from a `FREQ=WEEKLY;BYDAY=..` rrule. */
export function weekdaysFromRrule(rrule: string | null): number[] {
  const byDay = rrule?.match(/BYDAY=([A-Z,]+)/)?.[1];
  if (!byDay) return [];
  return byDay
    .split(",")
    .map((c) => WEEKDAY_RRULE.indexOf(c as (typeof WEEKDAY_RRULE)[number]))
    .filter((n) => n >= 0)
    .sort((a, b) => a - b);
}

export interface UpcomingEventCard {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  eventType: EventType;
  startTime: number;
  recurrenceEnd: number | null;
  resourceName: string;
  weekdays: number[];
  /** Public form slug, if the event has one bound. */
  formSlug: string | null;
  /** Whether the form is published, within its window, and not full (registration open). */
  formOpen: boolean;
}

/**
 * Public, auth-free list of PUBLISHED events that are still upcoming or ongoing — i.e. whose
 * last occurrence (recurrenceEnd, or endTime for one-offs) hasn't passed. Ordered newest first
 * by start date. Powers the landing "Próximos eventos" carousel. Draft/paused events never
 * surface publicly.
 */
export async function getUpcomingPublicEvents(
  limit = 12,
): Promise<UpcomingEventCard[]> {
  const nowNum = nowMs();
  const now = BigInt(nowNum);

  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { recurrenceEnd: { gte: now } },
        { recurrenceEnd: null, endTime: { gte: now } },
      ],
    },
    orderBy: { startTime: "desc" },
    take: limit,
    include: {
      resource: {
        select: {
          name: true,
          fungibleResource: { select: { capacity: true } },
        },
      },
      form: {
        select: {
          slug: true,
          isPublished: true,
          opensAt: true,
          closesAt: true,
        },
      },
      _count: { select: { participants: { where: { cancelled: false } } } },
    },
  });

  return events.map((e) => {
    const cap = e.capacity ?? e.resource.fungibleResource?.capacity ?? null;
    const isFull = cap !== null && e._count.participants >= cap;
    const formOpen = Boolean(
      e.form?.isPublished &&
      Number(e.form.opensAt) <= nowNum &&
      nowNum <= Number(e.form.closesAt) &&
      !isFull,
    );
    return {
      id: e.id,
      name: e.name,
      description: e.description,
      imageUrl: e.imageUrl,
      eventType: e.eventType,
      startTime: Number(e.startTime),
      recurrenceEnd: e.recurrenceEnd ? Number(e.recurrenceEnd) : null,
      resourceName: e.resource.name,
      weekdays: weekdaysFromRrule(e.rrule),
      formSlug: e.form?.slug ?? null,
      formOpen,
    };
  });
}
