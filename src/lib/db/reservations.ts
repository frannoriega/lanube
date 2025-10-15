import { prisma } from "@/lib/prisma";
import {
    EventType,
    Prisma,
    ReservableType,
    Reservation,
    ReservationException,
    ReservationStatus,
} from "@prisma/client";

// Types
export interface ReservationWithRelations extends Reservation {
  resource?: {
    id: string;
    name: string;
    serialNumber: string | null;
    fungibleResource: {
      id: string;
      name: string;
      type: string;
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
  resourceId?: string;
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
}

// Refresh reservation ledger for a time window (or full if not provided)
export async function rebuildReservationLedger(
  startTime?: Date,
  endTime?: Date
): Promise<void> {
  await prisma.$executeRaw`
    SELECT rebuild_reservation_ledger(
      ${startTime || null}::timestamptz,
      ${endTime || null}::timestamptz
    )
  `;
}

// Get ledger rows by fungible resource type
export async function getReservationLedgerByType(
  resourceType: string,
  startTime: Date,
  endTime: Date
): Promise<ReservationLedgerRow[]> {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM get_reservation_ledger_by_type(
      ${resourceType}::resource_types,
      ${startTime}::timestamptz,
      ${endTime}::timestamptz
    )
  `;

  return rows.map((row) => ({
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
  }));
}

// Find merged full-capacity time slots by resource type
export async function findFullCapacitySlotsByType(
  resourceType: string,
  startTime: Date,
  endTime: Date
): Promise<{ slotStart: Date; slotEnd: Date; capacity: number; totalUsed: number }[]> {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM find_full_capacity_slots_by_type(
      ${resourceType}::resource_types,
      ${startTime}::timestamptz,
      ${endTime}::timestamptz
    )
  `;

  return rows.map((row) => ({
    slotStart: new Date(row.slot_start),
    slotEnd: new Date(row.slot_end),
    capacity: Number(row.capacity),
    totalUsed: Number(row.total_used),
  }));
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Creates a new reservation
 * Validates capacity using the database function check_availability_with_actor
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

  // If resourceId is provided, check capacity
  if (data.resourceId) {
    const hasCapacity = await checkResourceAvailability(
      data.resourceId,
      data.reservableType,
      data.reservableId,
      data.startTime,
      data.endTime
    );

    if (!hasCapacity) {
      throw new Error("Resource is not available for the selected time range");
    }
  }

  // Validate recurring reservation data
  if (data.isRecurring && !data.rrule) {
    throw new Error("Recurring reservations must have an rrule");
  }

  if (data.isRecurring && !data.recurrenceEnd) {
    throw new Error("Recurring reservations must have a recurrence end date");
  }

  const reservation = await prisma.reservation.create({
    data: {
      reservableType: data.reservableType,
      reservableId: data.reservableId,
      resourceId: data.resourceId,
      eventType: data.eventType,
      reason: data.reason,
      startTime: data.startTime,
      endTime: data.endTime,
      isRecurring: data.isRecurring || false,
      rrule: data.rrule,
      recurrenceEnd: data.recurrenceEnd,
      status: "PENDING",
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

/**
 * Lists expanded reservation occurrences (including recurring reservation instances)
 * Uses the PostgreSQL function expand_recurring_reservations
 */
export async function listExpandedReservations(
  filters?: ReservationFilters,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{ occurrences: ExpandedReservationOccurrence[]; total: number }> {
  const limit = Math.min(options?.limit || 50, 100);
  const offset = Math.max(options?.offset || 0, 0);

  // Build filter parameters for the PostgreSQL function
  const params: any[] = [
    filters?.reservableType || null,
    filters?.reservableId || null,
    filters?.resourceId || null,
    Array.isArray(filters?.status) ? filters.status[0] : filters?.status || null,
    filters?.eventType || null,
    filters?.startTimeFrom || null,
    filters?.startTimeTo || null,
    filters?.endTimeFrom || null,
    filters?.endTimeTo || null,
    limit,
    offset,
  ];

  // Call the PostgreSQL function to expand recurring reservations
  const occurrences = await prisma.$queryRaw<any[]>`
    SELECT * FROM expand_recurring_reservations(
      ${params[0]}::reservable_types,
      ${params[1]}::text,
      ${params[2]}::text,
      ${params[3]}::reservation_statuses,
      ${params[4]}::event_types,
      ${params[5]}::timestamptz,
      ${params[6]}::timestamptz,
      ${params[7]}::timestamptz,
      ${params[8]}::timestamptz,
      ${params[9]}::int,
      ${params[10]}::int
    )
  `;

  // Get total count
  const countParams = params.slice(0, 9); // Exclude limit and offset
  const totalResult = await prisma.$queryRaw<[{ count_expanded_reservations: bigint }]>`
    SELECT count_expanded_reservations(
      ${countParams[0]}::reservable_types,
      ${countParams[1]}::text,
      ${countParams[2]}::text,
      ${countParams[3]}::reservation_statuses,
      ${countParams[4]}::event_types,
      ${countParams[5]}::timestamptz,
      ${countParams[6]}::timestamptz,
      ${countParams[7]}::timestamptz,
      ${countParams[8]}::timestamptz
    )
  `;

  const total = Number(totalResult[0]?.count_expanded_reservations || 0);

  // Map database result to our interface
  const mappedOccurrences: ExpandedReservationOccurrence[] = occurrences.map(
    (row: any) => ({
      reservationId: row.reservation_id,
      occurrenceDate: new Date(row.occurrence_date),
      occurrenceStartTime: new Date(row.occurrence_start_time),
      occurrenceEndTime: new Date(row.occurrence_end_time),
      reservableType: row.reservable_type as ReservableType,
      reservableId: row.reservable_id,
      resourceId: row.resource_id,
      eventType: row.event_type as EventType,
      reason: row.reason,
      deniedReason: row.denied_reason,
      status: row.status as ReservationStatus,
      isRecurring: row.is_recurring,
      isException: row.is_exception,
      exceptionCancelled: row.exception_cancelled,
      rrule: row.rrule,
      recurrenceEnd: row.recurrence_end ? new Date(row.recurrence_end) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    })
  );

  return { occurrences: mappedOccurrences, total };
}

/**
 * Gets expanded user reservations (including recurring instances)
 */
export async function getExpandedUserReservations(
  userId: string,
  options?: {
    includeExpired?: boolean;
    status?: ReservationStatus[];
    limit?: number;
    offset?: number;
  }
): Promise<{ occurrences: ExpandedReservationOccurrence[]; total: number }> {
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

  return await listExpandedReservations(filters, {
    limit: options?.limit,
    offset: options?.offset,
  });
}

/**
 * Gets expanded resource reservations (including recurring instances)
 */
export async function getExpandedResourceReservations(
  resourceId: string,
  startTime: Date,
  endTime: Date,
  includeStatuses: ReservationStatus[] = ["PENDING", "APPROVED"]
): Promise<ExpandedReservationOccurrence[]> {
  const { occurrences } = await listExpandedReservations(
    {
      resourceId,
      status: includeStatuses,
      startTimeFrom: startTime,
      endTimeTo: endTime,
    },
    {
      limit: 100,
    }
  );

  return occurrences;
}

/**
 * Gets upcoming expanded reservations (including recurring instances)
 */
export async function getExpandedUpcomingReservations(
  reservableType: ReservableType,
  reservableId: string,
  limit: number = 10
): Promise<ExpandedReservationOccurrence[]> {
  const { occurrences } = await listExpandedReservations(
    {
      reservableType,
      reservableId,
      status: ["PENDING", "APPROVED"],
      startTimeFrom: new Date(),
    },
    {
      limit,
    }
  );

  return occurrences;
}

/**
 * Gets expanded reservations for calendar view by resource type
 * Shows APPROVED reservations OR user's own reservations
 * Automatically finds all fungible resources and their individual resources
 * Single database query for maximum efficiency
 */
export async function getExpandedReservationsForCalendar(
  resourceType: string,
  userId: string,
  startTime: Date,
  endTime: Date
): Promise<ExpandedReservationOccurrence[]> {
  try {
    console.log('CRUD: Calling expand_reservations_for_calendar_by_type with:', {
      resourceType,
      userId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });

    // Call the PostgreSQL function that handles everything in one query
    const occurrences = await prisma.$queryRaw<any[]>`
      SELECT * FROM expand_reservations_for_calendar_by_type(
        ${resourceType}::resource_types,
        ${userId}::text,
        ${startTime}::timestamptz,
        ${endTime}::timestamptz
      )
    `;

    console.log('CRUD: Raw occurrences from DB:', occurrences.length, occurrences);

    // Map database result to our interface
    const mappedOccurrences: ExpandedReservationOccurrence[] = occurrences.map(
      (row: any) => ({
        reservationId: row.reservation_id,
        occurrenceDate: new Date(row.occurrence_date),
        occurrenceStartTime: new Date(row.occurrence_start_time),
        occurrenceEndTime: new Date(row.occurrence_end_time),
        reservableType: row.reservable_type as ReservableType,
        reservableId: row.reservable_id,
        resourceId: row.resource_id,
        eventType: row.event_type as EventType,
        reason: row.reason,
        deniedReason: row.denied_reason,
        status: row.status as ReservationStatus,
        isRecurring: row.is_recurring,
        isException: row.is_exception,
        exceptionCancelled: row.exception_cancelled,
        rrule: row.rrule,
        recurrenceEnd: row.recurrence_end ? new Date(row.recurrence_end) : null,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      })
    );

    return mappedOccurrences;
  } catch (error) {
    console.error("Error getting calendar reservations:", error);
    throw new Error("Failed to fetch calendar reservations");
  }
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Updates a reservation
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

  // If changing resource or time, check capacity
  const resourceChanged = data.resourceId && data.resourceId !== existing.resourceId;
  const timeChanged = data.startTime || data.endTime;

  if ((resourceChanged || timeChanged) && (data.resourceId || existing.resourceId)) {
    const resourceToCheck = data.resourceId || existing.resourceId!;

    const hasCapacity = await checkResourceAvailability(
      resourceToCheck,
      existing.reservableType,
      existing.reservableId,
      newStartTime,
      newEndTime,
      id // Exclude current reservation from capacity check
    );

    if (!hasCapacity) {
      throw new Error("Resource is not available for the selected time range");
    }
  }

  // Validate recurring reservation updates
  if (data.isRecurring && !data.rrule && !existing.rrule) {
    throw new Error("Recurring reservations must have an rrule");
  }

  if (data.isRecurring && !data.recurrenceEnd && !existing.recurrenceEnd) {
    throw new Error("Recurring reservations must have a recurrence end date");
  }

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
 * Approves a reservation
 */
export async function approveReservation(
  id: string
): Promise<ReservationWithRelations> {
  return await updateReservation(id, { status: "APPROVED" });
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
 * Checks if a resource is available for a given time range
 * Uses the database function check_availability_with_actor
 */
export async function checkResourceAvailability(
  resourceId: string,
  reservableType: ReservableType,
  reservableId: string,
  startTime: Date,
  endTime: Date,
  excludeReservationId?: string
): Promise<boolean> {
  try {
    // Use raw SQL to call the database function
    const result = await prisma.$queryRaw<[{ check_availability_with_actor: boolean }]>`
      SELECT check_availability_with_actor(
        ${resourceId}::text,
        ${reservableType}::reservable_types,
        ${reservableId}::text,
        ${startTime}::timestamptz,
        ${endTime}::timestamptz
      )
    `;

    if (!result[0]?.check_availability_with_actor) {
      return false;
    }

    // Additional check: ensure no overlapping reservations
    // (the function checks capacity, but we also want to avoid exact overlaps)
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

    const overlapping = await prisma.reservation.findFirst({
      where: whereClause,
    });

    return !overlapping;
  } catch (error) {
    console.error("Error checking resource availability:", error);
    throw new Error("Failed to check resource availability");
  }
}

/**
 * Gets the actor size (number of people represented by a reservable entity)
 * Uses the database function get_actor_size
 */
export async function getActorSize(
  reservableType: ReservableType,
  reservableId: string
): Promise<number> {
  try {
    const result = await prisma.$queryRaw<[{ get_actor_size: number }]>`
      SELECT get_actor_size(
        ${reservableType}::reservable_types,
        ${reservableId}::text
      )
    `;

    return result[0]?.get_actor_size || 1;
  } catch (error) {
    console.error("Error getting actor size:", error);
    return 1;
  }
}

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
