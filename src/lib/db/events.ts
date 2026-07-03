import {
  ADMIN_TIMEZONE,
  dateKeyFromUnixMs,
  endOfDateKeyMs,
  isValidDateKey,
  startOfDateKeyMs,
} from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { bindFormToEvent, unbindFormFromEvent } from "@/lib/db/forms";
import { dateTimeLocalToMs, msToDateTimeLocal } from "@/lib/events/datetime";
import { OccurrencePlan, planEventOccurrences } from "@/lib/events/plan";
import {
  DroppedSession,
  ExistingException,
  RawReservation,
  detectDroppedExceptions,
  utcDateKey,
  weekdayOfRrule,
} from "@/lib/events/occurrences";
import {
  notifyEventParticipantsBatch,
  OccurrenceChange,
} from "@/lib/email/event-occurrence-update";
import { prisma } from "@/lib/prisma";
import {
  EventInput,
  SessionActionInput,
  WEEKDAY_RRULE,
} from "@/lib/schemas/events";
import { createId } from "@paralleldrive/cuid2";
import { TZDate } from "@date-fns/tz";
import {
  Event,
  EventType,
  Prisma,
  ResourceType,
} from "@/generated/prisma/client";

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

/** Thrown by updateEvent when the edit would drop exceptions and `force` wasn't given. */
export class EventEditDropWarning extends Error {
  dropped: DroppedSession[];
  constructor(dropped: DroppedSession[]) {
    super("La edición eliminaría sesiones con cambios");
    this.name = "EventEditDropWarning";
    this.dropped = dropped;
  }
}

/** Maps a Prisma event reservation (+ exceptions) to the pure `RawReservation` shape. */
export function toRawReservation(r: {
  id: string;
  startTime: bigint;
  endTime: bigint;
  recurrenceEnd: bigint | null;
  rrule: string | null;
  exceptions: Array<{
    id: string;
    exceptionDate: bigint;
    isCancelled: boolean;
    newStartTime: bigint | null;
    newEndTime: bigint | null;
    reason: string | null;
    createdAt: bigint;
  }>;
}): RawReservation {
  return {
    id: r.id,
    startMs: Number(r.startTime),
    endMs: Number(r.endTime),
    recurrenceEndMs: Number(r.recurrenceEnd ?? r.endTime),
    rrule: r.rrule,
    exceptions: r.exceptions.map((ex) => ({
      id: ex.id,
      exceptionDateMs: Number(ex.exceptionDate),
      isCancelled: ex.isCancelled,
      newStartMs: ex.newStartTime != null ? Number(ex.newStartTime) : null,
      newEndMs: ex.newEndTime != null ? Number(ex.newEndTime) : null,
      reason: ex.reason ?? null,
      createdAtMs: Number(ex.createdAt),
    })),
  };
}

/**
 * Rebuilds one event reservation's forward ledger honoring its exceptions
 * (`effective_occurrence_window` is applied inside the SQL function).
 */
async function rebuildLedger(
  tx: Prisma.TransactionClient,
  reservationId: string,
): Promise<void> {
  await tx.$executeRawUnsafe(
    "SELECT rebuild_reservation_ledger_forward($1::text)",
    reservationId,
  );
}

/**
 * Hard-blocks a reschedule whose new window would collide with another session on the resource
 * (the rebuild path itself performs no conflict check — see the reschedule_overlap_guard migration).
 */
async function assertRescheduleFree(
  tx: Prisma.TransactionClient,
  reservationId: string,
  newStartMs: number,
  newEndMs: number,
): Promise<void> {
  const rows = await tx.$queryRaw<{ conflicts: boolean }[]>`
    SELECT reservation_window_conflicts(
      ${reservationId}::text, ${newStartMs}::bigint, ${newEndMs}::bigint
    ) AS conflicts
  `;
  if (rows[0]?.conflicts) {
    throw new Error(
      "El nuevo horario se superpone con otra sesión en ese recurso",
    );
  }
}

/**
 * Recomputes the Event's denormalized window from its reservations + exceptions:
 * `startTime`/`endTime` from the earliest occurrence (for the card's time display),
 * `recurrenceEnd` = max end including rescheduled windows (so a reschedule past the old end
 * auto-extends the event), and the combined BYDAY rrule from the surviving weekdays.
 */
async function recomputeEventWindow(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<void> {
  const reservations = await tx.reservation.findMany({
    where: { reservableType: "EVENT", reservableId: eventId },
    include: { exceptions: true },
  });
  if (reservations.length === 0) return;

  const earliest = reservations.reduce((a, b) =>
    Number(a.startTime) <= Number(b.startTime) ? a : b,
  );
  let start = Number(earliest.startTime);
  const end = Number(earliest.endTime);
  let recEnd = Math.max(
    ...reservations.map((r) => Number(r.recurrenceEnd ?? r.endTime)),
  );
  for (const r of reservations) {
    for (const ex of r.exceptions) {
      if (ex.newEndTime != null)
        recEnd = Math.max(recEnd, Number(ex.newEndTime));
      if (ex.newStartTime != null)
        start = Math.min(start, Number(ex.newStartTime));
    }
  }
  const byDay = reservations
    .map((r) => weekdayOfRrule(r.rrule))
    .filter((w): w is number => w != null)
    .sort((a, b) => a - b)
    .map((w) => WEEKDAY_RRULE[w])
    .join(",");

  await tx.event.update({
    where: { id: eventId },
    data: {
      startTime: start,
      endTime: end,
      recurrenceEnd: recEnd,
      rrule: byDay ? `FREQ=WEEKLY;BYDAY=${byDay}` : null,
    },
  });
}

/**
 * Updates an event, **preserving per-occurrence exceptions**. Instead of deleting + recreating
 * all reservations, it diffs weekdays and updates in place (one recurring reservation per
 * weekday). If the edit would drop exceptions (a removed weekday, an out-of-range date, or a
 * resource change) it throws `EventEditDropWarning` unless `force` is set.
 */
export async function updateEvent(
  id: string,
  input: EventInput,
  opts: {
    force?: boolean;
    sessionActions?: SessionActionInput[];
    /** Single reason shared by every staged cancel/reschedule in this save. */
    sessionReason?: string;
  } = {},
): Promise<Event> {
  const force = opts.force ?? false;
  const plans = planEventOccurrences(input);
  if (plans.length === 0) {
    throw new Error(
      "El rango de fechas no contiene ninguno de los días elegidos",
    );
  }

  const plansByWeekday = new Map<number, OccurrencePlan>();
  for (const p of plans) {
    const w = weekdayOfRrule(p.rrule);
    if (w != null) plansByWeekday.set(w, p);
  }

  try {
    // Collected inside the tx, emailed as a single digest only after it commits.
    const changes: OccurrenceChange[] = [];
    const event = await prisma.$transaction(async (tx) => {
      const existing = await tx.event.findUnique({ where: { id } });
      if (!existing) throw new Error("Evento no encontrado");

      const capacity =
        input.capacity ?? (await getResourceCapacity(tx, input.resourceId));
      if (capacity === null) {
        throw new Error("El recurso seleccionado no existe");
      }

      const existingRes = await tx.reservation.findMany({
        where: { reservableType: "EVENT", reservableId: id },
        include: { exceptions: true },
      });
      const resourceChanged = existing.resourceId !== input.resourceId;

      const rawExisting = existingRes.map(toRawReservation);

      if (resourceChanged) {
        // Moving resource re-places every reservation, so all exceptions are dropped.
        const { dropped } = detectDroppedExceptions(
          rawExisting,
          new Set(),
          input.startDate,
          input.endDate,
        );
        if (dropped.length > 0 && !force) {
          throw new EventEditDropWarning(dropped);
        }
        await deleteEventReservations(tx, id);
        await insertEventReservations(
          tx,
          id,
          input.eventType,
          input.name,
          plans,
          input.resourceId,
        );
      } else {
        const byWeekday = new Map<number, (typeof existingRes)[number]>();
        for (const r of existingRes) {
          const w = weekdayOfRrule(r.rrule);
          if (w != null) byWeekday.set(w, r);
        }

        // Detect dropped exceptions: removed weekday, or exceptionDate outside the new range.
        const { dropped, droppedIds } = detectDroppedExceptions(
          rawExisting,
          new Set(plansByWeekday.keys()),
          input.startDate,
          input.endDate,
        );
        if (dropped.length > 0 && !force) {
          throw new EventEditDropWarning(dropped);
        }

        // Remove deselected weekdays (cascades their exceptions + ledger).
        for (const [w, r] of byWeekday) {
          if (!plansByWeekday.has(w)) {
            await tx.$executeRaw`DELETE FROM reservation_ledger WHERE reservation_id = ${r.id}`;
            await tx.reservation.delete({ where: { id: r.id } });
          }
        }
        // Drop out-of-range exceptions on surviving weekdays before rebuilding.
        if (droppedIds.length > 0) {
          await tx.reservationException.deleteMany({
            where: { id: { in: droppedIds } },
          });
        }
        // Add / update per weekday.
        for (const [w, p] of plansByWeekday) {
          const r = byWeekday.get(w);
          if (!r) {
            await insertEventReservations(
              tx,
              id,
              input.eventType,
              input.name,
              [p],
              input.resourceId,
            );
          } else {
            await tx.reservation.update({
              where: { id: r.id },
              data: {
                reason: input.name,
                startTime: p.startMs,
                endTime: p.endMs,
                recurrenceEnd: p.recurrenceEndMs,
              },
            });
            await rebuildLedger(tx, r.id);
          }
        }
      }

      // Metadata (window fields are set by recomputeEventWindow below).
      await tx.event.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description ?? null,
          eventType: input.eventType,
          status: input.status,
          resourceId: input.resourceId,
          capacity: input.capacity ?? null,
          imageUrl: input.imageUrl ?? null,
          // Editing + saving revives a cancelled event.
          deletedAt: null,
        },
      });

      await syncEventForm(tx, id, input);
      // Apply staged per-session changes (cancel/reschedule/revert) now, so nothing persists —
      // and no participant email is sent — until the whole event save commits.
      await applySessionActions(
        tx,
        id,
        opts.sessionActions ?? [],
        opts.sessionReason ?? "",
        changes,
      );
      await recomputeEventWindow(tx, id);

      return tx.event.findUniqueOrThrow({ where: { id } });
    });

    // One digest email per participant, only after the transaction commits (never on a
    // rolled-back edit). The shared reason is carried once for the whole batch.
    if (changes.length > 0) {
      await notifyEventParticipantsBatch(id, {
        eventName: input.name,
        reason: opts.sessionReason?.trim() || undefined,
        changes,
      });
    }
    return event;
  } catch (error) {
    if (error instanceof EventEditDropWarning) throw error;
    translateSqlError(error);
  }
}

/**
 * Applies staged session actions to the event's (post-diff) reservations: resolves each by weekday,
 * replaces any exception on that date (one per date), then records a cancel/reschedule exception or,
 * for revert, just clears it. Collects the participant notifications to send after commit. Rebuilds
 * the ledger of every touched reservation.
 */
async function applySessionActions(
  tx: Prisma.TransactionClient,
  eventId: string,
  actions: SessionActionInput[],
  reason: string,
  changes: OccurrenceChange[],
): Promise<void> {
  if (actions.length === 0) return;

  // Every cancel/reschedule must record why (business rule); the reason is shared across the batch
  // (stored on each exception row for admin visibility; emailed once by the caller).
  const needsReason = actions.some(
    (a) => a.kind === "cancel" || a.kind === "reschedule",
  );
  if (needsReason && reason.trim() === "") {
    throw new Error("El motivo del cambio de sesiones es obligatorio");
  }
  const batchReason = reason.trim();

  const reservations = await tx.reservation.findMany({
    where: { reservableType: "EVENT", reservableId: eventId },
    include: { exceptions: { select: { id: true, exceptionDate: true } } },
  });
  const byWeekday = new Map<number, (typeof reservations)[number]>();
  for (const r of reservations) {
    const w = weekdayOfRrule(r.rrule);
    if (w != null) byWeekday.set(w, r);
  }

  const touched = new Set<string>();
  for (const a of actions) {
    const r = byWeekday.get(a.weekday);
    if (!r) continue; // weekday no longer part of the event
    const duration = Number(r.endTime) - Number(r.startTime);
    const key = utcDateKey(a.occurrenceDateMs);

    // One exception per date: drop any existing one first.
    const stale = r.exceptions
      .filter((ex) => utcDateKey(Number(ex.exceptionDate)) === key)
      .map((ex) => ex.id);
    if (stale.length > 0) {
      await tx.reservationException.deleteMany({
        where: { id: { in: stale } },
      });
    }

    if (a.kind === "cancel") {
      await tx.reservationException.create({
        data: {
          reservationId: r.id,
          exceptionDate: BigInt(a.occurrenceDateMs),
          isCancelled: true,
          reason: batchReason,
        },
      });
      changes.push({
        kind: "cancelled",
        originalStartMs: a.occurrenceDateMs,
        originalEndMs: a.occurrenceDateMs + duration,
      });
    } else if (a.kind === "reschedule") {
      await assertRescheduleFree(tx, r.id, a.newStartMs, a.newEndMs);
      await tx.reservationException.create({
        data: {
          reservationId: r.id,
          exceptionDate: BigInt(a.occurrenceDateMs),
          isCancelled: false,
          newStartTime: BigInt(a.newStartMs),
          newEndTime: BigInt(a.newEndMs),
          reason: batchReason,
        },
      });
      changes.push({
        kind: "rescheduled",
        originalStartMs: a.occurrenceDateMs,
        originalEndMs: a.occurrenceDateMs + duration,
        newStartMs: a.newStartMs,
        newEndMs: a.newEndMs,
      });
    } else if (stale.length > 0) {
      // Revert only notifies if it actually removed a saved exception.
      changes.push({
        kind: "restored",
        originalStartMs: a.occurrenceDateMs,
        originalEndMs: a.occurrenceDateMs + duration,
      });
    }
    touched.add(r.id);
  }

  for (const rid of touched) {
    await rebuildLedger(tx, rid);
  }
}

/**
 * Soft-deletes (cancels) an event: marks `deletedAt`, frees its reservations so the resource
 * is no longer blocked, and keeps the event + form + participant history. The event then shows
 * as "Cancelado" in admin and disappears from every public surface.
 */
export async function deleteEvent(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.event.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Evento no encontrado");
    }
    await deleteEventReservations(tx, id);
    await tx.event.update({
      where: { id },
      data: { deletedAt: nowMs() },
    });
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

// ============================================================================
// Per-occurrence (session) exceptions
// ============================================================================

/**
 * The event's saved session exceptions, each tagged with its reservation's weekday. Feeds the
 * admin session editor, which overlays them (plus staged changes) on a client-side preview —
 * the actual cancel/reschedule/revert is applied by `updateEvent` when the event is saved.
 */
export async function getEventSessionExceptions(
  eventId: string,
): Promise<ExistingException[]> {
  const reservations = await prisma.reservation.findMany({
    where: { reservableType: "EVENT", reservableId: eventId },
    include: { exceptions: true },
  });
  const out: ExistingException[] = [];
  for (const r of reservations) {
    const weekday = weekdayOfRrule(r.rrule);
    if (weekday == null) continue;
    for (const ex of r.exceptions) {
      out.push({
        weekday,
        occurrenceDateMs: Number(ex.exceptionDate),
        isCancelled: ex.isCancelled,
        newStartMs: ex.newStartTime != null ? Number(ex.newStartTime) : null,
        newEndMs: ex.newEndTime != null ? Number(ex.newEndTime) : null,
        reason: ex.reason ?? null,
      });
    }
  }
  return out;
}

export interface EventListFilters {
  page?: number;
  pageSize?: number;
  /** Display status: DRAFT | PUBLISHED | PAUSED | ENDED | CANCELLED. */
  status?: string;
  /** Filter by the resource's ResourceType (AUDITORIUM, COWORKING, …). */
  resourceType?: string;
  /** Date range (admin-tz "yyyy-MM-dd" keys); an event matches if it overlaps the range. */
  from?: string;
  to?: string;
}

/**
 * Builds the where-clause for the admin events list. Display statuses ENDED/CANCELLED are
 * derived (date / deletedAt), so they map to date or deletedAt conditions rather than the
 * stored `status` column.
 */
function buildEventListWhere(
  filters: EventListFilters,
): Prisma.EventWhereInput {
  const now = BigInt(nowMs());
  const and: Prisma.EventWhereInput[] = [];

  const endedOr: Prisma.EventWhereInput[] = [
    { recurrenceEnd: { lt: now } },
    { recurrenceEnd: null, endTime: { lt: now } },
  ];
  const liveOr: Prisma.EventWhereInput[] = [
    { recurrenceEnd: { gte: now } },
    { recurrenceEnd: null, endTime: { gte: now } },
  ];

  switch (filters.status) {
    case "CANCELLED":
      and.push({ deletedAt: { not: null } });
      break;
    case "ENDED":
      and.push({ deletedAt: null, OR: endedOr });
      break;
    case "DRAFT":
    case "PUBLISHED":
    case "PAUSED":
      and.push({ deletedAt: null, status: filters.status, OR: liveOr });
      break;
  }

  if (filters.resourceType) {
    and.push({ resource: { type: filters.resourceType as ResourceType } });
  }

  // Overlap with [from, to]: starts on/before `to` AND last occurrence on/after `from`.
  if (filters.to && isValidDateKey(filters.to)) {
    and.push({ startTime: { lte: BigInt(endOfDateKeyMs(filters.to)) } });
  }
  if (filters.from && isValidDateKey(filters.from)) {
    const fromMs = BigInt(startOfDateKeyMs(filters.from));
    and.push({
      OR: [
        { recurrenceEnd: { gte: fromMs } },
        { recurrenceEnd: null, endTime: { gte: fromMs } },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

/** Paginated events, newest first, with optional filters. Returns items + total. */
export async function listEvents(filters: EventListFilters = {}) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 9;
  const where = buildEventListWhere(filters);
  const [events, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      orderBy: { startTime: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        resource: { select: { id: true, name: true, type: true } },
        form: {
          select: {
            id: true,
            slug: true,
            isPublished: true,
            opensAt: true,
            closesAt: true,
          },
        },
        _count: { select: { participants: true } },
      },
    }),
    prisma.event.count({ where }),
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

/** Registration phase for the landing CTA. */
export type RegistrationPhase = "none" | "upcoming" | "open" | "closed";

export interface UpcomingEventCard {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  eventType: EventType;
  startMs: number;
  recurrenceEndMs: number | null;
  resourceName: string;
  weekdays: number[];
  /** Public form slug, if the event has one bound. */
  formSlug: string | null;
  /** none = no form; upcoming = not open yet; open = accepting; closed = window over/full. */
  registration: RegistrationPhase;
  /** Registration window (UNIX ms); null when the event has no form. */
  formOpensAt: number | null;
  formClosesAt: number | null;
  hasExceptions: boolean;
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
      deletedAt: null,
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
    const opensAt = e.form ? Number(e.form.opensAt) : null;
    const closesAt = e.form ? Number(e.form.closesAt) : null;

    let registration: RegistrationPhase;
    if (!e.form || opensAt === null || closesAt === null) registration = "none";
    else if (opensAt > nowNum) registration = "upcoming";
    else if (nowNum <= closesAt && !isFull) registration = "open";
    else registration = "closed";

    return {
      id: e.id,
      name: e.name,
      description: e.description,
      imageUrl: e.imageUrl,
      eventType: e.eventType,
      startMs: Number(e.startTime),
      recurrenceEndMs: e.recurrenceEnd ? Number(e.recurrenceEnd) : null,
      resourceName: e.resource.name,
      weekdays: weekdaysFromRrule(e.rrule),
      formSlug: e.form?.slug ?? null,
      registration,
      formOpensAt: opensAt,
      formClosesAt: closesAt,
      hasExceptions: false,
    };
  });
}

/**
 * Paginated version of `getUpcomingPublicEvents`. Returns the same cards plus a total
 * count and `hasExceptions` flag per event (true if any ReservationException exists on
 * the event's reservations — any status, any date).
 */
export async function getUpcomingPublicEventsPage(
  page: number,
  pageSize: number,
): Promise<{
  events: UpcomingEventCard[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const nowNum = nowMs();
  const now = BigInt(nowNum);
  const where = {
    status: "PUBLISHED" as const,
    deletedAt: null,
    OR: [
      { recurrenceEnd: { gte: now } },
      { recurrenceEnd: null, endTime: { gte: now } },
    ],
  };

  const [rawEvents, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      orderBy: { startTime: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    }),
    prisma.event.count({ where }),
  ]);

  // Determine which events have at least one ReservationException (any date/status).
  const eventIds = rawEvents.map((e) => e.id);
  const reservationsWithExceptions = await prisma.reservation.findMany({
    where: {
      reservableType: "EVENT",
      reservableId: { in: eventIds },
      exceptions: { some: {} },
    },
    select: { reservableId: true },
  });
  const withExceptions = new Set(
    reservationsWithExceptions.map((r) => r.reservableId),
  );

  const events: UpcomingEventCard[] = rawEvents.map((e) => {
    const cap = e.capacity ?? e.resource.fungibleResource?.capacity ?? null;
    const isFull = cap !== null && e._count.participants >= cap;
    const opensAt = e.form ? Number(e.form.opensAt) : null;
    const closesAt = e.form ? Number(e.form.closesAt) : null;

    let registration: RegistrationPhase;
    if (!e.form || opensAt === null || closesAt === null) registration = "none";
    else if (opensAt > nowNum) registration = "upcoming";
    else if (nowNum <= closesAt && !isFull) registration = "open";
    else registration = "closed";

    return {
      id: e.id,
      name: e.name,
      description: e.description,
      imageUrl: e.imageUrl,
      eventType: e.eventType,
      startMs: Number(e.startTime),
      recurrenceEndMs: e.recurrenceEnd ? Number(e.recurrenceEnd) : null,
      resourceName: e.resource.name,
      weekdays: weekdaysFromRrule(e.rrule),
      formSlug: e.form?.slug ?? null,
      registration,
      formOpensAt: opensAt,
      formClosesAt: closesAt,
      hasExceptions: withExceptions.has(e.id),
    };
  });

  return { events, total, page, pageSize };
}

export interface PublicEventDetail {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  eventType: EventType;
  startTime: number;
  endTime: number;
  recurrenceEnd: number | null;
  weekdays: number[];
  resourceName: string;
  registration: RegistrationPhase;
  formSlug: string | null;
  formOpensAt: number | null;
  formClosesAt: number | null;
  reservations: RawReservation[];
}

/**
 * Public event detail for the /events/[id] page. Returns null for non-existent,
 * non-PUBLISHED, or soft-deleted events. Includes all reservations with their
 * exceptions so the caller can expand the full agenda.
 */
export async function getPublicEventDetail(
  id: string,
): Promise<PublicEventDetail | null> {
  const nowNum = nowMs();

  const event = await prisma.event.findUnique({
    where: { id },
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

  if (!event || event.status !== "PUBLISHED" || event.deletedAt !== null) {
    return null;
  }

  const rawReservations = await prisma.reservation.findMany({
    where: { reservableType: "EVENT", reservableId: id },
    include: { exceptions: true },
  });

  const cap =
    event.capacity ?? event.resource.fungibleResource?.capacity ?? null;
  const isFull = cap !== null && event._count.participants >= cap;
  const opensAt = event.form ? Number(event.form.opensAt) : null;
  const closesAt = event.form ? Number(event.form.closesAt) : null;

  const lastOccurrenceMs = event.recurrenceEnd
    ? Number(event.recurrenceEnd)
    : Number(event.endTime);

  let registration: RegistrationPhase;
  if (!event.form || opensAt === null || closesAt === null)
    registration = "none";
  else if (lastOccurrenceMs < nowNum) registration = "closed";
  else if (opensAt > nowNum) registration = "upcoming";
  else if (nowNum <= closesAt && !isFull) registration = "open";
  else registration = "closed";

  return {
    id: event.id,
    name: event.name,
    description: event.description,
    imageUrl: event.imageUrl,
    eventType: event.eventType,
    startTime: Number(event.startTime),
    endTime: Number(event.endTime),
    recurrenceEnd: event.recurrenceEnd ? Number(event.recurrenceEnd) : null,
    weekdays: weekdaysFromRrule(event.rrule),
    resourceName: event.resource.name,
    registration,
    formSlug: event.form?.slug ?? null,
    formOpensAt: opensAt,
    formClosesAt: closesAt,
    reservations: rawReservations.map(toRawReservation),
  };
}
