/**
 * Check-in DB helpers
 *
 * Encapsulates check-in creation, retrieval and checkout logic.
 */
import { prisma } from "@/lib/prisma";

/** Returns a User by email or null. */
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/** Returns the active check-in for a user if any. */
export async function getActiveCheckinByUserId(userId: string) {
  return prisma.checkIn.findFirst({
    where: { userId, checkOutTime: null },
    include: { reservation: { select: { service: true, startTime: true, endTime: true } } },
  });
}

/**
 * Creates a check-in for the given user.
 * If reservationId is provided, validates that it is APPROVED and within 30 minutes of start.
 * Throws an Error for business rule violations.
 */
export async function createCheckin(userId: string, reservationId?: string) {
  // One active checkin per user
  const active = await prisma.checkIn.findFirst({ where: { userId, checkOutTime: null } });
  if (active) throw new Error("Ya tienes un check-in activo");

  if (reservationId) {
    const reservation = await prisma.reservation.findFirst({
      where: { id: reservationId, userId, status: 'APPROVED' },
    });
    if (!reservation) throw new Error("Reserva no encontrada o no aprobada");
    const now = new Date();
    const startTime = new Date(reservation.startTime);
    const diffMin = Math.abs(now.getTime() - startTime.getTime()) / (1000 * 60);
    if (diffMin > 30) throw new Error("No puedes hacer check-in fuera del horario de tu reserva");
  }

  return prisma.checkIn.create({
    data: { userId, reservationId: reservationId || null, checkInTime: new Date() },
    include: { reservation: { select: { service: true, startTime: true, endTime: true } } },
  });
}

/** Checks out a user's active check-in by id. Returns null if none. */
export async function checkoutUserCheckin(userId: string, checkinId: string) {
  const checkIn = await prisma.checkIn.findFirst({ where: { id: checkinId, userId, checkOutTime: null } });
  if (!checkIn) return null;
  return prisma.checkIn.update({
    where: { id: checkinId },
    data: { checkOutTime: new Date(), updatedAt: new Date() },
    include: { reservation: { select: { service: true, startTime: true, endTime: true } } },
  });
}


