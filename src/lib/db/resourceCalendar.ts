import {
  getUnavailableSlots,
  getUserNextReservations,
} from "@/lib/db/reservations";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
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

  const [unavailableSlotsRaw, allUserReservations] = await Promise.all([
    getUnavailableSlots(resourceType, startDate, endDate, userId),
    getUserNextReservations(userId, undefined, 100, 0),
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
  const resourceTypeMap = new Map<string, ResourceType>();
  if (uniqueResourceIds.length > 0) {
    const resources = await prisma.resource.findMany({
      where: { id: { in: uniqueResourceIds } },
      select: { id: true, type: true },
    });
    for (const r of resources) {
      resourceTypeMap.set(r.id, r.type);
    }
  }

  const userReservations: ReservationOccurrence[] = [];
  const crossResourceSlots: CalendarUnavailableSlot[] = [];

  for (const res of allUserReservations) {
    const ms = Number(res.occurrenceStartTime);
    if (ms < rangeStartMs || ms > rangeEndMs) continue;

    const resType = res.resourceId
      ? resourceTypeMap.get(res.resourceId)
      : undefined;

    if (resType === resourceType) {
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
      resType !== undefined &&
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

  return {
    unavailableSlots: [
      ...unavailableSlotsRaw.map((s) => ({
        resourceId: s.resourceId,
        startTime: Number(s.startTime),
        endTime: Number(s.endTime),
        kind: "resource_full" as UnavailableSlotKind,
      })),
      ...crossResourceSlots,
    ],
    userReservations,
  };
}
