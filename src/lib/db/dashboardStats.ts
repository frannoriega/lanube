import { prisma } from "@/lib/prisma";

export interface DashboardStats {
  upcomingReservations: number;
  totalTimeThisWeek: number;
  totalTimeThisMonth: number;
  recentReservations: Array<{
    id: string;
    service: string;
    serviceType: string;
    startTime: Date;
    endTime: Date;
    status: string;
    reason: string | null;
  }>;
}

const HOURS_IN_MS = 1000 * 60 * 60;

function toHours(reservations: Array<{ startTime: Date; endTime: Date }>): number {
  const total = reservations.reduce((acc, reservation) => {
    const duration = reservation.endTime.getTime() - reservation.startTime.getTime();
    return acc + Math.max(duration, 0);
  }, 0);

  return Math.round((total / HOURS_IN_MS) * 10) / 10;
}

export async function getDashboardStatsByUserId(userId: string): Promise<DashboardStats> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [upcomingReservations, reservationsThisWeek, reservationsThisMonth, recentReservations] =
    await Promise.all([
      prisma.reservation.count({
        where: {
          reservableId: userId,
          startTime: {
            gte: now,
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
            gte: startOfWeek,
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
            gte: startOfMonth,
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
              type: true,
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
      service: reservation.resource?.name ?? reservation.resource?.type ?? "Servicio",
      serviceType: reservation.resource?.type ?? "UNKNOWN",
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      status: reservation.status,
      reason: reservation.reason ?? null,
    })),
  };
}

export async function getDashboardStatsByEmail(email: string): Promise<DashboardStats | null> {
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
