import { now, nowMs } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import { dateToUnixMs } from "@/lib/unix-ms";

export async function isAdminByEmail(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.id) return false;
  const reg = await prisma.registeredUser.findUnique({ where: { userId: user.id } });
  return !!reg && reg.role === "ADMIN";
}

export async function getAdminAggregateStats() {
  const at = now();
  const startOfDay = new Date(at); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(at); startOfWeek.setDate(at.getDate() - at.getDay()); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(at.getFullYear(), at.getMonth(), 1);

  const [todayUsers, weekUsers, monthUsers, pendingReservations, approvedReservations, rejectedReservations] = await Promise.all([
    prisma.checkIn.count({ where: { checkInTime: { gte: dateToUnixMs(startOfDay) } } }),
    prisma.checkIn.count({ where: { checkInTime: { gte: dateToUnixMs(startOfWeek) } } }),
    prisma.checkIn.count({ where: { checkInTime: { gte: dateToUnixMs(startOfMonth) } } }),
    prisma.reservation.count({ where: { status: 'PENDING' } }),
    prisma.reservation.count({ where: { status: 'APPROVED', startTime: { gte: dateToUnixMs(at) } } }),
    prisma.reservation.count({ where: { status: 'REJECTED' } }),
  ]);

  const currentUsersRaw = await prisma.checkIn.findMany({
    where: { checkOutTime: null, checkInTime: { gte: dateToUnixMs(startOfDay) } },
    include: {
      registeredUser: { select: { id: true, name: true, lastName: true } },
      reservation: { select: { resource: { select: { type: true } }, endTime: true } },
    },
    orderBy: { checkInTime: 'desc' },
  });

  const recentReservationsRaw = await prisma.reservation.findMany({
    where: { status: 'PENDING' },
    include: { registeredUser: { select: { name: true, lastName: true } }, resource: { select: { type: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return {
    todayUsers,
    weekUsers,
    monthUsers,
    pendingReservations,
    approvedReservations,
    rejectedReservations,
    currentUsers: currentUsersRaw.map(ci => ({
      id: ci.registeredUser.id,
      name: ci.registeredUser.name,
      lastName: ci.registeredUser.lastName,
      checkInTime: Number(ci.checkInTime),
      reservationEndTime:
        ci.reservation?.endTime != null ? Number(ci.reservation.endTime) : null,
      service: ci.reservation?.resource?.type || 'UNKNOWN',
    })),
    recentReservations: recentReservationsRaw.map(r => ({
      id: r.id,
      user: { name: r.registeredUser.name, lastName: r.registeredUser.lastName },
      service: r.resource?.type || 'UNKNOWN',
      startTime: Number(r.startTime),
      endTime: Number(r.endTime),
      status: r.status,
      reason: r.reason,
    })),
  };
}

export async function getCurrentCheckinsForToday() {
  const at = now();
  const startOfDay = new Date(at); startOfDay.setHours(0, 0, 0, 0);
  const rows = await prisma.checkIn.findMany({
    where: { checkOutTime: null, checkInTime: { gte: dateToUnixMs(startOfDay) } },
    include: {
      registeredUser: { select: { id: true, name: true, lastName: true, user: { select: { email: true } }, dni: true } },
      reservation: { select: { resource: { select: { type: true } }, endTime: true } },
    },
    orderBy: { checkInTime: 'desc' },
  });
  return rows.map(ci => ({
    id: ci.registeredUser.id,
    name: ci.registeredUser.name,
    lastName: ci.registeredUser.lastName,
    email: ci.registeredUser.user.email,
    dni: ci.registeredUser.dni,
    checkInTime: Number(ci.checkInTime),
    reservationEndTime:
      ci.reservation?.endTime != null ? Number(ci.reservation.endTime) : null,
    service: ci.reservation?.resource?.type || 'UNKNOWN',
    reservationId: ci.reservationId || '',
  }));
}

export async function checkoutActiveCheckinByUserId(userId: string) {
  const checkIn = await prisma.checkIn.findFirst({
    where: { registeredUser: { userId: userId }, checkOutTime: null },
  });
  if (!checkIn) return null;
  return prisma.checkIn.update({
    where: { id: checkIn.id },
    data: { checkOutTime: BigInt(nowMs()) },
    include: {
      registeredUser: { select: { name: true, lastName: true, user: { select: { email: true } } } },
      reservation: { select: { resource: { select: { type: true } }, startTime: true, endTime: true } },
    },
  });
}


