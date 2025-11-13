import { getUnavailableSlots, getUserNextReservations } from "@/lib/db/reservations";
import { prisma } from "@/lib/prisma";
import { ReservableType, ResourceType } from "@prisma/client";

export interface ReservationOccurrence {
  reservationId: string;
  occurrenceStartTime: string;
  occurrenceEndTime: string;
  reason: string;
  status: string;
  reservableType: string;
  reservableId: string;
}

/** Returns the RegisteredUser ID for a given account email, or null. */
export async function getRegisteredUserIdByEmail(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { registeredUser: true },
  });
  return user?.registeredUser?.id ?? null;
}

/** Fetches calendar data: unavailable slots (by other users) and user's own reservations. */
export async function getCalendarDataByType(
  resourceType: ResourceType,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{ unavailableSlots: any[]; userReservations: ReservationOccurrence[] }> {
  // Get unavailable time slots for this resource type (excluding user's own reservations)
  const unavailableSlots = await getUnavailableSlots(
    resourceType,
    startDate,
    endDate,
    userId
  );

  console.log("unavailableSlots", unavailableSlots);

  // Get user's reservations from the ledger
  const allUserReservations = await getUserNextReservations(userId, resourceType, 100, 0);

  console.log("allUserReservations", allUserReservations);

  // Filter to only include reservations in the date range for this resource type
  const userReservations = allUserReservations.filter((res) => {
    const inDateRange = 
      res.occurrenceStartTime >= startDate && 
      res.occurrenceStartTime <= endDate;
    // We'll need to check resource type by querying the resource
    return inDateRange;
  });

  console.log("userReservations", userReservations);

  return {
    unavailableSlots,
    userReservations: userReservations.map((res) => ({
      reservationId: res.id,
      occurrenceStartTime: res.occurrenceStartTime.toISOString(),
      occurrenceEndTime: res.occurrenceEndTime.toISOString(),
      reason: res.reason ?? "",
      status: res.status,
      reservableType: res.reservableType as ReservableType,
      reservableId: res.reservableId,
    }))
  };
}

