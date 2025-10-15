import { createReservation, getExpandedReservationsForCalendar } from "@/lib/db/reservations";
import { prisma } from "@/lib/prisma";
import { EventType, ResourceType } from "@prisma/client";

/** Returns the RegisteredUser ID for a given account email, or null. */
export async function getRegisteredUserIdByEmail(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { registeredUser: true },
  });
  return user?.registeredUser?.id ?? null;
}

/** Fetches calendar occurrences and metadata (capacity, resources) for a resource type. */
export async function getCalendarDataByType(
  resourceType: ResourceType,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{ occurrences: any[]; capacity: number; resources: any[] }> {
  const occurrences = await getExpandedReservationsForCalendar(
    resourceType,
    userId,
    startDate,
    endDate
  );

  const fungibleResource = await prisma.fungibleResource.findFirst({
    where: { type: resourceType },
    include: { resources: true },
  });

  return {
    occurrences,
    capacity: fungibleResource?.capacity || 1,
    resources: fungibleResource?.resources || [],
  };
}

/** Creates a reservation on the first resource of the given type. */
export async function createReservationForType(
  resourceType: ResourceType,
  registeredUserId: string,
  startTime: Date,
  endTime: Date,
  reason: string,
  eventType: EventType
) {
  const fungibleResource = await prisma.fungibleResource.findFirst({
    where: { type: resourceType },
    include: { resources: true },
  });

  if (!fungibleResource || fungibleResource.resources.length === 0) {
    throw new Error(`No hay recursos del tipo ${resourceType} disponibles`);
  }

  const resourceId = fungibleResource.resources[0].id;

  return createReservation({
    reservableType: "USER",
    reservableId: registeredUserId,
    resourceId,
    eventType,
    reason,
    startTime,
    endTime,
  });
}


