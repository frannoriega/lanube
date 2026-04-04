import {
  getUnavailableSlots,
  getUserNextReservations,
} from "@/lib/db/reservations";
import { prisma } from "@/lib/prisma";
import { dateToUnixMs } from "@/lib/unix-ms";
import { ReservableType, ResourceType } from "@/generated/prisma/client";

export interface ReservationOccurrence {
  reservationId: string;
  occurrenceStartTime: number;
  occurrenceEndTime: number;
  reason: string;
  status: string;
  reservableType: string;
  reservableId: string;
}

export interface CalendarUnavailableSlot {
  resourceId: string;
  startTime: number;
  endTime: number;
}

/** Returns the RegisteredUser ID for a given account email, or null. */
export async function getRegisteredUserIdByEmail(
  email: string,
): Promise<string | null> {
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
  endDate: Date,
): Promise<{
  unavailableSlots: CalendarUnavailableSlot[];
  userReservations: ReservationOccurrence[];
}> {
  const rangeStartMs = dateToUnixMs(startDate);
  const rangeEndMs = dateToUnixMs(endDate);

  const unavailableSlots = await getUnavailableSlots(
    resourceType,
    startDate,
    endDate,
    userId,
  );

  const allUserReservations = await getUserNextReservations(
    userId,
    resourceType,
    100,
    0,
  );

  const userReservations = allUserReservations.filter((res) => {
    const t = res.occurrenceStartTime;
    return t >= rangeStartMs && t <= rangeEndMs;
  });

  return {
    unavailableSlots: unavailableSlots.map((s) => ({
      resourceId: s.resourceId,
      startTime: Number(s.startTime),
      endTime: Number(s.endTime),
    })),
    userReservations: userReservations.map((res) => ({
      reservationId: res.id,
      occurrenceStartTime: Number(res.occurrenceStartTime),
      occurrenceEndTime: Number(res.occurrenceEndTime),
      reason: res.reason ?? "",
      status: res.status,
      reservableType: res.reservableType as ReservableType,
      reservableId: res.reservableId,
    })),
  };
}
