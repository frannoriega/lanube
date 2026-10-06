import { currentPeriodsInAdminTz } from "@/lib/admin/admin-timezone";
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
  const atMs = dateToUnixMs(now());
  // Semana y mes en la hora del predio, con su fin (milestone 25, C1/C2): antes se calculaban
  // en la zona del servidor (UTC en Vercel) y sin tope, así que "esta semana" sumaba también
  // todas las reservas futuras.
  const { week, month } = currentPeriodsInAdminTz(Number(atMs));
  // `reservableType: "USER"` además de `reservableId`: el índice es
  // `(reservable_type, reservable_id)` y Postgres no lo usa con la segunda columna sola — sin
  // esto las cuatro consultas recorrían toda la tabla en cada carga del dashboard
  // (milestone 25, DB4). Y es lo correcto: el id es de un usuario.
  const mine = { reservableType: "USER", reservableId: userId } as const;
  const approvedIn = (period: { startMs: number; endMs: number }) =>
    prisma.reservation.findMany({
      select: { startTime: true, endTime: true },
      where: {
        ...mine,
        status: "APPROVED",
        startTime: { gte: BigInt(period.startMs), lte: BigInt(period.endMs) },
      },
    });

  const [
    upcomingReservations,
    reservationsThisWeek,
    reservationsThisMonth,
    recentReservations,
  ] = await Promise.all([
    prisma.reservation.count({
      where: { ...mine, startTime: { gte: atMs }, status: "APPROVED" },
    }),
    approvedIn(week),
    approvedIn(month),
    prisma.reservation.findMany({
      select: {
        id: true,
        space: { select: { name: true } },
        startTime: true,
        endTime: true,
        status: true,
        reason: true,
      },
      where: mine,
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
      service: reservation.space?.name ?? "Servicio",
      serviceType: reservation.space?.name ?? "Unknown",
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
