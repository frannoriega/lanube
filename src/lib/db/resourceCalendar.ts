import {
  getUnavailableSlots,
  getUserNextReservations,
} from "@/lib/db/reservations";
import { nowMs } from "@/lib/clock";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import { prisma } from "@/lib/prisma";
import { dateToUnixMs } from "@/lib/unix-ms";
import { ReservableType } from "@/generated/prisma/client";

export interface ReservationOccurrence {
  reservationId: string;
  occurrenceStartTime: number;
  occurrenceEndTime: number;
  reason: string;
  status: string;
  reservableType: string;
  reservableId: string;
  /** Present for EVENT occurrences: the owning event. */
  eventId?: string;
  /** Public form slug, if the event has a form. */
  formSlug?: string | null;
  /** Whether the form is currently published, within its window, and not full. */
  formOpen?: boolean;
}

/** Why a time slot is unavailable. Extend this union for new blocking reasons. */
export type UnavailableSlotKind = "resource_full" | "cross_resource";

export interface CalendarUnavailableSlot {
  resourceId: string;
  startTime: number;
  endTime: number;
  kind: UnavailableSlotKind;
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

interface EventOccurrenceRow {
  reservation_id: string;
  event_id: string;
  resource_id: string;
  occurrence_start_time: bigint;
  occurrence_end_time: bigint;
  reason: string | null;
}

/**
 * APPROVED EVENT occurrences for a fungible resource in a window. These render on the calendar
 * as named, read-only cards (with a form link) rather than anonymous unavailable blocks.
 */
export async function getEventOccurrencesForFungibleResource(
  fungibleResourceId: string,
  startDate: Date,
  endDate: Date,
): Promise<ReservationOccurrence[]> {
  const rangeStartMs = dateToUnixMs(startDate);
  const rangeEndMs = dateToUnixMs(endDate);

  const rows = await prisma.$queryRaw<EventOccurrenceRow[]>`
    SELECT l.reservation_id, l.reservable_id AS event_id, l.resource_id,
           l.occurrence_start_time, l.occurrence_end_time, l.reason
    FROM reservation_ledger l
    JOIN resources r ON r.id = l.resource_id
    WHERE l.reservable_type = 'EVENT'
      AND l.status = 'APPROVED'
      AND r.fungible_resource_id = ${fungibleResourceId}
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
      capacity: true,
      resource: {
        select: { fungibleResource: { select: { capacity: true } } },
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

  const now = nowMs();
  const meta = new Map(
    events.map((e) => {
      const cap = e.capacity ?? e.resource.fungibleResource?.capacity ?? null;
      const isFull = cap !== null && e._count.participants >= cap;
      const formOpen = Boolean(
        e.form?.isPublished &&
        Number(e.form.opensAt) <= now &&
        now <= Number(e.form.closesAt) &&
        !isFull,
      );
      return [e.id, { name: e.name, formSlug: e.form?.slug ?? null, formOpen }];
    }),
  );

  // The ledger stores each occurrence as contiguous 15-min buckets (insert_into_ledger), so a
  // 10:00–11:00 event is 4 rows. Merge adjacent buckets of the same reservation back into one
  // span; gaps (e.g. between weekly occurrences) stay separate.
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
      reason: m?.name ?? group[0].reason ?? "Evento",
      status: "APPROVED",
      reservableType: "EVENT",
      reservableId: group[0].event_id,
      eventId: group[0].event_id,
      formSlug: m?.formSlug ?? null,
      formOpen: m?.formOpen ?? false,
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
export async function getCalendarDataByFungibleResource(
  fungibleResourceId: string,
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<{
  unavailableSlots: CalendarUnavailableSlot[];
  userReservations: ReservationOccurrence[];
}> {
  const rangeStartMs = dateToUnixMs(startDate);
  const rangeEndMs = dateToUnixMs(endDate);

  const [unavailableSlotsRaw, allUserReservations, eventOccurrences] =
    await Promise.all([
      getUnavailableSlots(fungibleResourceId, startDate, endDate, userId),
      getUserNextReservations(userId, undefined, 100, 0),
      getEventOccurrencesForFungibleResource(
        fungibleResourceId,
        startDate,
        endDate,
      ),
    ]);

  // Resolve each reservation's resource type so we can split:
  //   - same resource type  -> show as a reservation card
  //   - different resource type (PENDING/APPROVED) -> block the slot (cross_resource)
  const uniqueResourceIds = [
    ...new Set(
      allUserReservations
        .map((r) => r.resourceId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const resourceFungibleMap = new Map<string, string>();
  if (uniqueResourceIds.length > 0) {
    const resources = await prisma.resource.findMany({
      where: { id: { in: uniqueResourceIds } },
      select: { id: true, fungibleResourceId: true },
    });
    for (const r of resources) {
      resourceFungibleMap.set(r.id, r.fungibleResourceId);
    }
  }

  const userReservations: ReservationOccurrence[] = [];
  const crossResourceSlots: CalendarUnavailableSlot[] = [];

  for (const res of allUserReservations) {
    const ms = Number(res.occurrenceStartTime);
    if (ms < rangeStartMs || ms > rangeEndMs) continue;

    const resFungibleId = res.resourceId
      ? resourceFungibleMap.get(res.resourceId)
      : undefined;

    if (resFungibleId === fungibleResourceId) {
      userReservations.push({
        reservationId: res.id,
        occurrenceStartTime: Number(res.occurrenceStartTime),
        occurrenceEndTime: Number(res.occurrenceEndTime),
        reason: res.reason ?? "",
        status: res.status,
        reservableType: res.reservableType as ReservableType,
        reservableId: res.reservableId,
      });
    } else if (
      resFungibleId !== undefined &&
      (res.status === "PENDING" || res.status === "APPROVED")
    ) {
      crossResourceSlots.push({
        resourceId: res.resourceId ?? "",
        startTime: Number(res.occurrenceStartTime),
        endTime: Number(res.occurrenceEndTime),
        kind: "cross_resource",
      });
    }
  }

  // Event occurrences fully block their resource, so get_unavailable_slots also reports
  // them as resource_full. Drop those windows here so each event renders once — as the
  // named, read-only card below — instead of an anonymous stripe underneath it.
  const resourceFullSlots = unavailableSlotsRaw
    .map((s) => ({
      resourceId: s.resourceId,
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

  return {
    unavailableSlots: [...resourceFullSlots, ...crossResourceSlots],
    userReservations: [...userReservations, ...eventOccurrences],
  };
}
