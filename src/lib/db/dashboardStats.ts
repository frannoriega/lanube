import { currentPeriodsInAdminTz } from "@/lib/admin/admin-timezone";
import { now } from "@/lib/clock";
import { approvedOccurrenceTotals, OPEN_END_MS } from "@/lib/db/occurrences";
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

/** Milisegundos → horas con un decimal. */
function toHours(totalMs: number): number {
  return Math.round((totalMs / HOURS_IN_MS) * 10) / 10;
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
  // `(reservable_type, reservable_id)` y Postgres no lo usa con la segunda columna sola
  // (milestone 25, DB4). Y es lo correcto: el id es de un usuario.
  const mine = { reservableType: "USER", reservableId: userId } as const;

  // Los tres números cuentan **ocurrencias** (milestone 25, C3): una reserva semanal suma cada
  // semana que cae en el período, no una vez en la semana en que empezó la serie.
  const [upcoming, thisWeek, thisMonth, recentReservations] = await Promise.all(
    [
      approvedOccurrenceTotals(Number(atMs), OPEN_END_MS, mine),
      approvedOccurrenceTotals(week.startMs, week.endMs, mine),
      approvedOccurrenceTotals(month.startMs, month.endMs, mine),
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
    ],
  );

  return {
    upcomingReservations: upcoming.count,
    totalTimeThisWeek: toHours(thisWeek.totalMs),
    totalTimeThisMonth: toHours(thisMonth.totalMs),
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
