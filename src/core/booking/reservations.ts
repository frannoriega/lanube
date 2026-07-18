import { prisma } from "@/lib/prisma";
import type { ReservableType } from "@/generated/prisma/client";
import {
  BookingError,
  type BlockingReservationSpec,
  type Db,
  type ExceptionSpec,
  type OwnerRef,
  type OwnerReservation,
  type ReservationWindow,
} from "./types";

/**
 * Booking core — reservation & ledger operations.
 *
 * This is the ONLY place reservation/ledger tables and the reservation SQL
 * functions are touched. Modules (e.g. events) call these operations instead of
 * reaching into `reservation` / `reservation_ledger` / `reservation_exceptions`
 * or the `create_event_reservation` / `rebuild_reservation_ledger_forward` /
 * `reservation_window_conflicts` functions. That keeps the ledger's capacity
 * invariants unbreakable from outside and makes the layer independently
 * extractable.
 *
 * Every operation accepts an optional `Db` (a Prisma client or an open
 * transaction). Callers that also mutate their own tables in the same unit of
 * work pass their `tx`.
 */

type PrismaExceptionRow = {
  id: string;
  exceptionDate: bigint;
  isCancelled: boolean;
  newStartTime: bigint | null;
  newEndTime: bigint | null;
  reason: string | null;
  createdAt: bigint;
};

type PrismaReservationRow = {
  id: string;
  startTime: bigint;
  endTime: bigint;
  recurrenceEnd: bigint | null;
  rrule: string | null;
  exceptions: PrismaExceptionRow[];
};

function toOwnerReservation(r: PrismaReservationRow): OwnerReservation {
  return {
    id: r.id,
    startMs: Number(r.startTime),
    endMs: Number(r.endTime),
    recurrenceEndMs: r.recurrenceEnd != null ? Number(r.recurrenceEnd) : null,
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

/** Capacity of a resource (space), or null if the resource doesn't exist. */
export async function getResourceCapacity(
  resourceId: string,
  db: Db = prisma,
): Promise<number | null> {
  const resource = await db.space.findUnique({
    where: { id: resourceId },
    select: { capacity: true },
  });
  return resource?.capacity ?? null;
}

/**
 * Creates one fully-blocking recurring reservation for an owner (status APPROVED,
 * actor_size = resource capacity) and populates its ledger. Rejects with
 * `ALREADY_BOOKED` if the resource is taken in any occurrence window.
 *
 * NOTE: currently wraps `create_event_reservation`, which hardcodes
 * `reservable_type = 'EVENT'`. Generalizing that SQL (rename +
 * parametrize the owner type) is a follow-up migration; until then this op only
 * supports EVENT owners.
 */
export async function createBlockingReservation(
  spec: BlockingReservationSpec,
  db: Db = prisma,
): Promise<void> {
  try {
    await db.$executeRaw`
      SELECT create_event_reservation(
        ${spec.reservationId}::text,
        ${spec.owner.id}::text,
        ${spec.resourceId}::text,
        ${spec.typeCode}::text,
        ${spec.reason}::text,
        ${spec.startMs}::bigint,
        ${spec.endMs}::bigint,
        true::boolean,
        ${spec.rrule}::text,
        ${spec.recurrenceEndMs}::bigint
      )
    `;
  } catch (error) {
    throw mapSqlError(error);
  }
}

/** Deletes every reservation for an owner (and its ledger rows). */
export async function deleteReservationsForOwner(
  owner: OwnerRef,
  db: Db = prisma,
): Promise<void> {
  await db.$executeRaw`
    DELETE FROM reservation_ledger
    WHERE reservation_id IN (
      SELECT id FROM reservations
      WHERE reservable_type = ${owner.type} AND reservable_id = ${owner.id}
    )
  `;
  await db.reservation.deleteMany({
    where: {
      reservableType: owner.type as ReservableType,
      reservableId: owner.id,
    },
  });
}

/** Deletes a single reservation and its ledger rows. */
export async function removeReservation(
  reservationId: string,
  db: Db = prisma,
): Promise<void> {
  await db.$executeRaw`DELETE FROM reservation_ledger WHERE reservation_id = ${reservationId}`;
  await db.reservation.delete({ where: { id: reservationId } });
}

/** Updates a reservation's recurrence window (does not rebuild the ledger). */
export async function updateReservationWindow(
  reservationId: string,
  window: ReservationWindow,
  db: Db = prisma,
): Promise<void> {
  await db.reservation.update({
    where: { id: reservationId },
    data: {
      reason: window.reason,
      startTime: window.startMs,
      endTime: window.endMs,
      recurrenceEnd: window.recurrenceEndMs,
    },
  });
}

/** All reservations for an owner, normalized (numbers), with their exceptions. */
export async function listReservationsForOwner(
  owner: OwnerRef,
  db: Db = prisma,
): Promise<OwnerReservation[]> {
  const reservations = await db.reservation.findMany({
    where: {
      reservableType: owner.type as ReservableType,
      reservableId: owner.id,
    },
    include: { exceptions: true },
  });
  return reservations.map(toOwnerReservation);
}

/** Of the given owner ids, the subset that has at least one exception (any date/status). */
export async function listOwnersWithExceptions(
  ownerType: string,
  ownerIds: string[],
  db: Db = prisma,
): Promise<Set<string>> {
  if (ownerIds.length === 0) return new Set();
  const rows = await db.reservation.findMany({
    where: {
      reservableType: ownerType as ReservableType,
      reservableId: { in: ownerIds },
      exceptions: { some: {} },
    },
    select: { reservableId: true },
  });
  return new Set(rows.map((r) => r.reservableId));
}

/**
 * Rebuilds one reservation's forward ledger honoring its exceptions
 * (`effective_occurrence_window` is applied inside the SQL function).
 */
export async function rebuildLedger(
  reservationId: string,
  db: Db = prisma,
): Promise<void> {
  await db.$executeRawUnsafe(
    "SELECT rebuild_reservation_ledger_forward($1::text)",
    reservationId,
  );
}

/**
 * Guards a reschedule: throws `RESCHEDULE_CONFLICT` if the new window would collide
 * with another session on the same resource (the ledger rebuild path itself does
 * no conflict check — see the reschedule_overlap_guard migration).
 */
export async function assertWindowFree(
  reservationId: string,
  newStartMs: number,
  newEndMs: number,
  db: Db = prisma,
): Promise<void> {
  const rows = await db.$queryRaw<{ conflicts: boolean }[]>`
    SELECT reservation_window_conflicts(
      ${reservationId}::text, ${newStartMs}::bigint, ${newEndMs}::bigint
    ) AS conflicts
  `;
  if (rows[0]?.conflicts) {
    throw new BookingError("RESCHEDULE_CONFLICT");
  }
}

/** Writes a single-occurrence exception (cancel or reschedule); returns its id. */
export async function setOccurrenceException(
  reservationId: string,
  spec: ExceptionSpec,
  db: Db = prisma,
): Promise<string> {
  const created = await db.reservationException.create({
    data: {
      reservationId,
      exceptionDate: BigInt(spec.exceptionDateMs),
      isCancelled: spec.isCancelled,
      newStartTime: spec.newStartMs != null ? BigInt(spec.newStartMs) : null,
      newEndTime: spec.newEndMs != null ? BigInt(spec.newEndMs) : null,
      reason: spec.reason,
    },
    select: { id: true },
  });
  return created.id;
}

/** Removes the given exceptions by id. */
export async function clearOccurrenceExceptions(
  exceptionIds: string[],
  db: Db = prisma,
): Promise<void> {
  if (exceptionIds.length === 0) return;
  await db.reservationException.deleteMany({
    where: { id: { in: exceptionIds } },
  });
}

/** Maps a raw reservation SQL error to a typed BookingError. */
function mapSqlError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message.includes("already booked")) {
      return new BookingError("ALREADY_BOOKED");
    }
    if (error.message.includes("not found")) {
      return new BookingError("RESOURCE_NOT_FOUND");
    }
  }
  return error instanceof Error ? error : new Error("Error desconocido");
}
