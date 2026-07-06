import { now } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import { dateToUnixMs } from "@/lib/unix-ms";

export interface DashboardStats {
  upcomingReservations: number;
  totalTimeThisWeek: number;
  totalTimeThisMonth: number;
  recentReservations: Array<{
    id: string;
    service: string;
    serviceType: string;
    startTime: number;
    endTime: number;
    status: string;
    reason: string | null;
  }>;
}

const HOURS_IN_MS = 1000 * 60 * 60;

function toHours(
  reservations: Array<{ startTime: bigint; endTime: bigint }>,
): number {
  const total = reservations.reduce((acc, reservation) => {
    const duration =
      Number(reservation.endTime) - Number(reservation.startTime);
    return acc + Math.max(duration, 0);
  }, 0);

  return Math.round((total / HOURS_IN_MS) * 10) / 10;
}

export async function getDashboardStatsByUserId(
  userId: string,
): Promise<DashboardStats> {
  const at = now();
  const atMs = dateToUnixMs(at);
  const startOfWeek = new Date(at);
  startOfWeek.setDate(at.getDate() - at.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(at.getFullYear(), at.getMonth(), 1);

  const [
    upcomingReservations,
    reservationsThisWeek,
    reservationsThisMonth,
    recentReservations,
  ] = await Promise.all([
    prisma.reservation.count({
      where: {
        reservableId: userId,
        startTime: {
          gte: atMs,
        },
        status: "APPROVED",
      },
    }),
    prisma.reservation.findMany({
      select: {
        startTime: true,
        endTime: true,
      },
      where: {
        reservableId: userId,
        startTime: {
          gte: dateToUnixMs(startOfWeek),
        },
        status: "APPROVED",
      },
    }),
    prisma.reservation.findMany({
      select: {
        startTime: true,
        endTime: true,
      },
      where: {
        reservableId: userId,
        startTime: {
          gte: dateToUnixMs(startOfMonth),
        },
        status: "APPROVED",
      },
    }),
    prisma.reservation.findMany({
      select: {
        id: true,
        resource: {
          select: {
            name: true,
            fungibleResource: { select: { name: true } },
          },
        },
        startTime: true,
        endTime: true,
        status: true,
        reason: true,
      },
      where: {
        reservableId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
  ]);

  return {
    upcomingReservations,
    totalTimeThisWeek: toHours(reservationsThisWeek),
    totalTimeThisMonth: toHours(reservationsThisMonth),
    recentReservations: recentReservations.map((reservation) => ({
      id: reservation.id,
      service:
        reservation.resource?.name ??
        reservation.resource?.fungibleResource?.name ??
        "Servicio",
      serviceType: reservation.resource?.fungibleResource?.name ?? "Unknown",
      startTime: Number(reservation.startTime),
      endTime: Number(reservation.endTime),
      status: reservation.status,
      reason: reservation.reason ?? null,
    })),
  };
}

export async function getDashboardStatsByEmail(
  email: string,
): Promise<DashboardStats | null> {
  const user = await prisma.registeredUser.findFirst({
    select: {
      id: true,
    },
    where: {
      user: {
        email,
      },
    },
  });

  if (!user) {
    return null;
  }

  return getDashboardStatsByUserId(user.id);
}
