import { prisma } from "@/lib/prisma";
import { createId } from '@paralleldrive/cuid2';
import {
  EventType,
  Prisma,
  ReservableType,
  Reservation,
  ReservationException,
  ReservationStatus,
  ResourceType,
} from "@prisma/client";

// Types
export interface ReservationWithRelations extends Reservation {
  resource?: {
    id: string;
    name: string;
    type: ResourceType;
    serialNumber: string | null;
    fungibleResource: {
      id: string;
      name: string;
      capacity: number;
    } | null;
  } | null;
  registeredUser?: {
    id: string;
    name: string;
    lastName: string;
  } | null;
  checkIns?: Array<{
    id: string;
    checkInTime: Date;
    checkOutTime: Date | null;
  }>;
  exceptions?: ReservationException[];
}

export interface CreateReservationInput {
  reservableType: ReservableType;
  reservableId: string;
  resourceType: ResourceType;
  eventType: EventType;
  reason: string;
  startTime: Date;
  endTime: Date;
  isRecurring?: boolean;
  rrule?: string;
  recurrenceEnd?: Date;
}

export interface UpdateReservationInput {
  resourceId?: string;
  eventType?: EventType;
  reason?: string;
  deniedReason?: string;
  status?: ReservationStatus;
  startTime?: Date;
  endTime?: Date;
  isRecurring?: boolean;
  rrule?: string;
  recurrenceEnd?: Date;
}

export interface ReservationFilters {
  reservableType?: ReservableType;
  reservableId?: string;
  resourceId?: string;
  status?: ReservationStatus | ReservationStatus[];
  eventType?: EventType;
  startTimeFrom?: Date;
  startTimeTo?: Date;
  endTimeFrom?: Date;
  endTimeTo?: Date;
  isRecurring?: boolean;
}

export interface ExpandedReservationOccurrence {
  reservationId: string;
  occurrenceDate: Date;
  occurrenceStartTime: Date;
  occurrenceEndTime: Date;
  reservableType: ReservableType;
  reservableId: string;
  resourceId: string | null;
  eventType: EventType;
  reason: string;
  deniedReason: string | null;
  status: ReservationStatus;
  isRecurring: boolean;
  isException: boolean;
  exceptionCancelled: boolean;
  rrule: string | null;
  recurrenceEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Ledger row type
export interface ReservationLedgerRow {
  id: string;
  reservationId: string;
  occurrenceStartTime: Date;
  occurrenceEndTime: Date;
  reservableType: ReservableType;
  reservableId: string;
  resourceId: string;
  eventType: EventType;
  reason: string | null;
  actorSize: number;
  status: ReservationStatus;
  createdAt: Date;
}

// Unavailable slot type
export interface UnavailableSlot {
  resourceId: string;
  startTime: Date;
  endTime: Date;
}
export interface ReservationOccurrence {
  reservationId: string;
  occurrenceStartTime: string;
  occurrenceEndTime: string;
  reason: string;
  status: string;
  reservableType: string;
  reservableId: string;
}
// ============================================================================
// CREATE
// ============================================================================

/**
 * Creates a new reservation using the ledger-based system
 * Auto-selects an available resource of the given type
 */
export async function createReservation(
  data: CreateReservationInput
): Promise<ReservationWithRelations> {
  // Validate dates
  if (data.startTime >= data.endTime) {
    throw new Error("Start time must be before end time");
  }

  if (data.startTime < new Date()) {
    throw new Error("Cannot create reservations in the past");
  }

  // Validate recurring reservation data
  if (data.isRecurring && !data.rrule) {
    throw new Error("Recurring reservations must have an rrule");
  }

  if (data.isRecurring && !data.recurrenceEnd) {
    throw new Error("Recurring reservations must have a recurrence end date");
  }

  // Generate IDs
  const reservationId = createId();

  // Call SQL function to create reservation with automatic resource selection
  try {
    await prisma.$executeRaw`
      SELECT create_reservation(
        ${reservationId}::text,
        ${data.reservableType}::reservable_types,
        ${data.reservableId}::text,
        ${data.resourceType}::resource_types,
        ${data.eventType}::event_types,
        ${data.reason}::text,
        ${data.startTime.toISOString()}::timestamptz,
        ${data.endTime.toISOString()}::timestamptz,
        ${Boolean(data.isRecurring)}::boolean,
        ${data.rrule || null}::text,
        ${data.recurrenceEnd?.toISOString() || null}::timestamptz
      )
    `;
  } catch (error) {
    if (error instanceof Error) {
      // Parse SQL errors for user-friendly messages
      if (error.message?.includes('No available')) {
        throw new Error("No hay recursos disponibles para el horario seleccionado");
      }
      if (error.message?.includes('Conflict on')) {
        throw new Error("Conflicto en una de las fechas de la recurrencia");
      }
      if (error.message?.includes('Capacity exceeded')) {
        throw new Error("Capacidad excedida en una de las fechas");
      }
    }
    throw error;
  }

  // Fetch the created reservation with relations
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      resource: { include: { fungibleResource: true } },
      registeredUser: { select: { id: true, name: true, lastName: true } },
      checkIns: { select: { id: true, checkInTime: true, checkOutTime: true } },
      exceptions: true,
    },
  });

  if (!reservation) {
    throw new Error("Created reservation not found");
  }

  return reservation;
}

/**
 * Creates a reservation exception (for recurring reservations)
 */
export async function createReservationException(
  reservationId: string,
  exceptionDate: Date,
  data: {
    isCancelled?: boolean;
    newStartTime?: Date;
    newEndTime?: Date;
    reason?: string;
  }
): Promise<ReservationException> {
  // Verify the reservation exists and is recurring
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    throw new Error("Reservation not found");
  }

  if (!reservation.isRecurring) {
    throw new Error("Cannot create exceptions for non-recurring reservations");
  }

  return await prisma.reservationException.create({
    data: {
      reservationId,
      exceptionDate,
      isCancelled: data.isCancelled || false,
      newStartTime: data.newStartTime,
      newEndTime: data.newEndTime,
      reason: data.reason,
    },
  });
}

// ============================================================================
// READ
// ============================================================================

/**
 * Gets a single reservation by ID with all relations
 */
export async function getReservationById(
  id: string
): Promise<ReservationWithRelations | null> {
  return await prisma.reservation.findUnique({
    where: { id },
    include: {
      resource: {
        include: {
          fungibleResource: true,
        },
      },
      registeredUser: {
        select: {
          id: true,
          name: true,
          lastName: true,
        },
      },
      checkIns: {
        select: {
          id: true,
          checkInTime: true,
          checkOutTime: true,
        },
      },
      exceptions: true,
    },
  });
}

/**
 * Lists reservations with filters and pagination
 */
export async function listReservations(
  filters?: ReservationFilters,
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: Prisma.ReservationOrderByWithRelationInput;
  }
): Promise<{ reservations: ReservationWithRelations[]; total: number }> {
  const where: Prisma.ReservationWhereInput = {};

  // Apply filters
  if (filters) {
    if (filters.reservableType) {
      where.reservableType = filters.reservableType;
    }
    if (filters.reservableId) {
      where.reservableId = filters.reservableId;
    }
    if (filters.resourceId) {
      where.resourceId = filters.resourceId;
    }
    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }
    if (filters.eventType) {
      where.eventType = filters.eventType;
    }
    if (filters.isRecurring !== undefined) {
      where.isRecurring = filters.isRecurring;
    }

    // Date range filters
    const dateFilters: Prisma.ReservationWhereInput[] = [];
    if (filters.startTimeFrom) {
      dateFilters.push({ startTime: { gte: filters.startTimeFrom } });
    }
    if (filters.startTimeTo) {
      dateFilters.push({ startTime: { lte: filters.startTimeTo } });
    }
    if (filters.endTimeFrom) {
      dateFilters.push({ endTime: { gte: filters.endTimeFrom } });
    }
    if (filters.endTimeTo) {
      dateFilters.push({ endTime: { lte: filters.endTimeTo } });
    }
    if (dateFilters.length > 0) {
      where.AND = dateFilters;
    }
  }

  const limit = Math.min(options?.limit || 50, 100);
  const offset = Math.max(options?.offset || 0, 0);

  const [reservations, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: {
        resource: {
          include: {
            fungibleResource: true,
          },
        },
        registeredUser: {
          select: {
            id: true,
            name: true,
            lastName: true,
          },
        },
        checkIns: {
          select: {
            id: true,
            checkInTime: true,
            checkOutTime: true,
          },
        },
        exceptions: true,
      },
      orderBy: options?.orderBy || { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.reservation.count({ where }),
  ]);

  return { reservations, total };
}

/**
 * Gets all reservations for a specific user
 */
export async function getUserReservations(
  userId: string,
  options?: {
    includeExpired?: boolean;
    status?: ReservationStatus[];
    limit?: number;
    offset?: number;
  }
): Promise<{ reservations: ReservationWithRelations[]; total: number }> {
  const filters: ReservationFilters = {
    reservableType: "USER",
    reservableId: userId,
  };

  if (options?.status) {
    filters.status = options.status;
  }

  if (!options?.includeExpired) {
    filters.endTimeFrom = new Date();
  }

  return await listReservations(filters, {
    limit: options?.limit,
    offset: options?.offset,
    orderBy: { startTime: "asc" },
  });
}

/**
 * Gets all reservations for a specific resource in a time range
 */
export async function getResourceReservations(
  resourceId: string,
  startTime: Date,
  endTime: Date,
  includeStatuses: ReservationStatus[] = ["PENDING", "APPROVED"]
): Promise<ReservationWithRelations[]> {
  const { reservations } = await listReservations(
    {
      resourceId,
      status: includeStatuses,
      startTimeFrom: startTime,
      endTimeTo: endTime,
    },
    {
      orderBy: { startTime: "asc" },
    }
  );

  return reservations;
}

/**
 * Gets upcoming reservations (future reservations that are approved or pending)
 */
export async function getUpcomingReservations(
  reservableType: ReservableType,
  reservableId: string,
  limit: number = 10
): Promise<ReservationWithRelations[]> {
  const { reservations } = await listReservations(
    {
      reservableType,
      reservableId,
      status: ["PENDING", "APPROVED"],
      startTimeFrom: new Date(),
    },
    {
      limit,
      orderBy: { startTime: "asc" },
    }
  );

  return reservations;
}


// ============================================================================
// UPDATE
// ============================================================================

/**
 * Updates a reservation
 * Note: In the ledger-based system, capacity validation happens during approval
 */
export async function updateReservation(
  id: string,
  data: UpdateReservationInput
): Promise<ReservationWithRelations> {
  // Get existing reservation
  const existing = await prisma.reservation.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error("Reservation not found");
  }

  // Validate date changes
  const newStartTime = data.startTime || existing.startTime;
  const newEndTime = data.endTime || existing.endTime;

  if (newStartTime >= newEndTime) {
    throw new Error("Start time must be before end time");
  }

  // Validate recurring reservation updates
  if (data.isRecurring && !data.rrule && !existing.rrule) {
    throw new Error("Recurring reservations must have an rrule");
  }

  if (data.isRecurring && !data.recurrenceEnd && !existing.recurrenceEnd) {
    throw new Error("Recurring reservations must have a recurrence end date");
  }

  // Update reservation
  // Note: Capacity validation is handled by the ledger system during approval
  return await prisma.reservation.update({
    where: { id },
    data: {
      resourceId: data.resourceId,
      eventType: data.eventType,
      reason: data.reason,
      deniedReason: data.deniedReason,
      status: data.status,
      startTime: data.startTime,
      endTime: data.endTime,
      isRecurring: data.isRecurring,
      rrule: data.rrule,
      recurrenceEnd: data.recurrenceEnd,
    },
    include: {
      resource: {
        include: {
          fungibleResource: true,
        },
      },
      registeredUser: {
        select: {
          id: true,
          name: true,
          lastName: true,
        },
      },
      checkIns: {
        select: {
          id: true,
          checkInTime: true,
          checkOutTime: true,
        },
      },
      exceptions: true,
    },
  });
}

/**
 * Approves a reservation and auto-rejects conflicting pending reservations
 * Uses the ledger-based SQL function
 */
export async function approveReservation(
  id: string
): Promise<{ reservation: ReservationWithRelations; autoRejectedIds: string[] }> {
  // Call SQL function
  const result = await prisma.$queryRaw<{ approved_id: string; auto_rejected_ids: string }[]>`
    SELECT * FROM approve_reservation(${id}::text)
  `;

  const autoRejectedIds = result[0]?.auto_rejected_ids
    ? result[0].auto_rejected_ids.split(',').filter(Boolean)
    : [];

  // Fetch updated reservation
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      resource: { include: { fungibleResource: true } },
      registeredUser: { select: { id: true, name: true, lastName: true } },
      checkIns: { select: { id: true, checkInTime: true, checkOutTime: true } },
      exceptions: true,
    },
  });

  if (!reservation) {
    throw new Error("Reservation not found after approval");
  }

  return { reservation, autoRejectedIds };
}

/**
 * Rejects a reservation
 */
export async function rejectReservation(
  id: string,
  deniedReason: string
): Promise<ReservationWithRelations> {
  return await updateReservation(id, {
    status: "REJECTED",
    deniedReason,
  });
}

/**
 * Cancels a reservation
 */
export async function cancelReservation(
  id: string
): Promise<ReservationWithRelations> {
  return await updateReservation(id, { status: "CANCELLED" });
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Deletes a reservation (hard delete)
 */
export async function deleteReservation(id: string): Promise<void> {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
  });

  if (!reservation) {
    throw new Error("Reservation not found");
  }

  // Check if reservation has started
  if (reservation.startTime < new Date()) {
    throw new Error("Cannot delete reservations that have already started");
  }

  await prisma.reservation.delete({
    where: { id },
  });
}

/**
 * Deletes a reservation exception
 */
export async function deleteReservationException(id: string): Promise<void> {
  await prisma.reservationException.delete({
    where: { id },
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================


/**
 * Gets reservation statistics for a time period
 */
export async function getReservationStats(
  startDate: Date,
  endDate: Date,
  filters?: {
    reservableType?: ReservableType;
    eventType?: EventType;
    resourceId?: string;
  }
): Promise<{
  total: number;
  byStatus: Record<ReservationStatus, number>;
  byEventType: Record<EventType, number>;
  byReservableType: Record<ReservableType, number>;
}> {
  const where: Prisma.ReservationWhereInput = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (filters?.reservableType) {
    where.reservableType = filters.reservableType;
  }
  if (filters?.eventType) {
    where.eventType = filters.eventType;
  }
  if (filters?.resourceId) {
    where.resourceId = filters.resourceId;
  }

  const [total, byStatus, byEventType, byReservableType] = await Promise.all([
    prisma.reservation.count({ where }),
    prisma.reservation.groupBy({
      by: ["status"],
      where,
      _count: true,
    }),
    prisma.reservation.groupBy({
      by: ["eventType"],
      where,
      _count: true,
    }),
    prisma.reservation.groupBy({
      by: ["reservableType"],
      where,
      _count: true,
    }),
  ]);

  return {
    total,
    byStatus: Object.fromEntries(
      byStatus.map((item) => [item.status, item._count])
    ) as Record<ReservationStatus, number>,
    byEventType: Object.fromEntries(
      byEventType.map((item) => [item.eventType, item._count])
    ) as Record<EventType, number>,
    byReservableType: Object.fromEntries(
      byReservableType.map((item) => [item.reservableType, item._count])
    ) as Record<ReservableType, number>,
  };
}

/**
 * Checks if a user has any active reservations
 */
export async function hasActiveReservations(userId: string): Promise<boolean> {
  const count = await prisma.reservation.count({
    where: {
      reservableType: "USER",
      reservableId: userId,
      status: {
        in: ["PENDING", "APPROVED"],
      },
      endTime: {
        gte: new Date(),
      },
    },
  });

  return count > 0;
}

/**
 * Gets conflicting reservations for a given time range and resource
 */
export async function getConflictingReservations(
  resourceId: string,
  startTime: Date,
  endTime: Date,
  excludeReservationId?: string
): Promise<ReservationWithRelations[]> {
  const whereClause: Prisma.ReservationWhereInput = {
    resourceId,
    status: {
      in: ["APPROVED", "PENDING"],
    },
    startTime: {
      lt: endTime,
    },
    endTime: {
      gt: startTime,
    },
  };

  if (excludeReservationId) {
    whereClause.id = {
      not: excludeReservationId,
    };
  }

  return await prisma.reservation.findMany({
    where: whereClause,
    include: {
      resource: {
        include: {
          fungibleResource: true,
        },
      },
      registeredUser: {
        select: {
          id: true,
          name: true,
          lastName: true,
        },
      },
      checkIns: {
        select: {
          id: true,
          checkInTime: true,
          checkOutTime: true,
        },
      },
      exceptions: true,
    },
    orderBy: {
      startTime: "asc",
    },
  });
}

// ============================================================================
// LEDGER-BASED FUNCTIONS
// ============================================================================

/**
 * Gets upcoming user reservations from the ledger (includes expanded recurrences)
 */
export async function getUserNextReservations(
  userId: string,
  resourceType?: ResourceType,
  limit: number = 10,
  offset: number = 0
): Promise<ReservationLedgerRow[]> {
  const rows = await prisma.$queryRaw<{
    id: string;
    reservation_id: string;
    occurrence_start_time: Date;
    occurrence_end_time: Date;
    reservable_type: ReservableType;
    reservable_id: string;
    resource_id: string;
    event_type: EventType;
    reason: string | null;
    actor_size: number;
    status: ReservationStatus;
    created_at: Date;
  }[]>`
    SELECT * FROM get_user_next_reservations(
      ${userId}::text,
      ${resourceType}::resource_types,
      ${limit}::int,
      ${offset}::int
    )
  `;

  return rows.map((row) => ({
    id: row.id,
    reservationId: row.reservation_id,
    occurrenceStartTime: new Date(row.occurrence_start_time),
    occurrenceEndTime: new Date(row.occurrence_end_time),
    reservableType: row.reservable_type as ReservableType,
    reservableId: row.reservable_id,
    resourceId: row.resource_id,
    eventType: row.event_type as EventType,
    reason: row.reason ?? null,
    actorSize: Number(row.actor_size),
    status: row.status as ReservationStatus,
    createdAt: new Date(row.created_at),
  }));
}

/**
 * Gets unavailable time slots for a resource type
 * (slots that are fully booked or exclusive by OTHER users)
 */
export async function getUnavailableSlots(
  resourceType: ResourceType,
  startTime: Date,
  endTime: Date,
  excludeUserId?: string
): Promise<UnavailableSlot[]> {
  const rows = await prisma.$queryRaw<{
    r_id: string;
    start_time: Date;
    end_time: Date;
  }[]>`
    SELECT * FROM get_unavailable_slots(
      ${resourceType}::resource_types,
      ${startTime.toISOString()}::timestamptz,
      ${endTime.toISOString()}::timestamptz,
      ${excludeUserId || null}::text
    )
  `;

  return rows.map((row) => ({
    resourceId: row.r_id,
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
  }));
}
