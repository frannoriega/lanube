/**
 * User Reservations DB helpers
 *
 * Encapsulates user-facing reservation queries and mutations used by API routes.
 */
import { prisma } from "@/lib/prisma";

/**
 * Returns a User by email or null.
 */
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/**
 * Lists reservations for a user, optionally filtered by service.
 */
export async function listUserReservations(
  userId: string,
  service?: string
) {
  return prisma.reservation.findMany({
    where: {
      userId,
      ...(service ? { service } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Returns true if there is an overlapping reservation for the given service and time range.
 */
export async function hasOverlappingReservation(
  service: string,
  start: Date,
  end: Date
) {
  const overlapping = await prisma.reservation.findFirst({
    where: {
      service,
      status: { in: ["PENDING", "APPROVED"] },
      OR: [
        {
          startTime: { lt: end },
          endTime: { gt: start },
        },
      ],
    },
  });
  return !!overlapping;
}

/**
 * Creates a reservation for the given user and service after overlap validation.
 * Throws an Error if overlaps are detected.
 */
export async function createUserReservation(
  userId: string,
  service: string,
  startTime: Date,
  endTime: Date,
  reason: string
) {
  // Overlap validation in DB
  const overlaps = await hasOverlappingReservation(service, startTime, endTime);
  if (overlaps) {
    throw new Error("Ya existe una reserva en ese horario");
  }

  return prisma.reservation.create({
    data: {
      userId,
      service,
      startTime,
      endTime,
      reason,
      status: "PENDING",
    },
  });
}


