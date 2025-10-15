import { prisma } from "@/lib/prisma";
import { ReservationStatus, ResourceType, UserRole } from "@prisma/client";

/**
 * Admin Reservations DB helpers
 *
 * These functions encapsulate admin-facing queries and updates related
 * to reservations, and are intended to be used by API routes.
 */

/**
 * Returns true if the given userId belongs to an admin RegisteredUser.
 */
/**
 * Returns whether a given userId corresponds to an ADMIN registered user.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.registeredUser.findUnique({ where: { userId } });
  return !!user && user.role === UserRole.ADMIN;
}

/**
 * Lists reservations for a given resource type, including related user and resource data.
 */
/**
 * Lists reservations filtered by resource type, including basic user and resource info.
 */
export async function listAdminReservationsByType(service: ResourceType) {
  return prisma.reservation.findMany({
    where: {
      resource: {
        fungibleResource: {
          type: service,
        },
      },
    },
    include: {
      resource: true,
      registeredUser: {
        select: {
          name: true,
          lastName: true,
          dni: true,
          institution: true,
          user: {
            select: { email: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Updates reservation status for admin workflows.
 */
/**
 * Updates the status of a reservation by id.
 */
export async function setReservationStatus(
  reservationId: string,
  status: ReservationStatus
) {
  return prisma.reservation.update({
    where: { id: reservationId },
    data: { status },
  });
}


