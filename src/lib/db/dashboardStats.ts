/**
 * Dashboard stats for a user's account email.
 */
import { prisma } from "@/lib/prisma";

export async function getDashboardStatsByEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [upcomingReservations, reservationsThisWeek, reservationsThisMonth, recentReservations] = await Promise.all([
    prisma.reservation.count({ where: { userId: user.id, startTime: { gte: now }, status: 'APPROVED' } }),
    prisma.reservation.findMany({ where: { userId: user.id, startTime: { gte: startOfWeek }, status: 'APPROVED' } }),
    prisma.reservation.findMany({ where: { userId: user.id, startTime: { gte: startOfMonth }, status: 'APPROVED' } }),
    prisma.reservation.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  const totalTimeThisWeek = Math.round(reservationsThisWeek.reduce((total, r) => total + ((new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / (1000*60*60)), 0) * 10) / 10;
  const totalTimeThisMonth = Math.round(reservationsThisMonth.reduce((total, r) => total + ((new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / (1000*60*60)), 0) * 10) / 10;

  return {
    upcomingReservations,
    totalTimeThisWeek,
    totalTimeThisMonth,
    recentReservations: recentReservations.map(r => ({
      id: r.id,
      service: r.service,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      reason: r.reason,
    })),
  };
}


