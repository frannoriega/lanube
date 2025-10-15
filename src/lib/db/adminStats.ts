import { prisma } from "@/lib/prisma";

export async function isAdminByEmail(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.id) return false;
  const reg = await prisma.registeredUser.findUnique({ where: { userId: user.id } });
  return !!reg && reg.role === "ADMIN";
}

export async function getAdminAggregateStats() {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayUsers, weekUsers, monthUsers, pendingReservations, approvedReservations, rejectedReservations] = await Promise.all([
    prisma.checkIn.count({ where: { checkInTime: { gte: startOfDay } } }),
    prisma.checkIn.count({ where: { checkInTime: { gte: startOfWeek } } }),
    prisma.checkIn.count({ where: { checkInTime: { gte: startOfMonth } } }),
    prisma.reservation.count({ where: { status: 'PENDING' } }),
    prisma.reservation.count({ where: { status: 'APPROVED', startTime: { gte: now } } }),
    prisma.reservation.count({ where: { status: 'REJECTED' } }),
  ]);

  const currentUsersRaw = await prisma.checkIn.findMany({
    where: { checkOutTime: null, checkInTime: { gte: startOfDay } },
    include: {
      user: { select: { id: true, name: true, lastName: true } },
      reservation: { select: { service: true, endTime: true } },
    },
    orderBy: { checkInTime: 'desc' },
  });

  const recentReservationsRaw = await prisma.reservation.findMany({
    where: { status: 'PENDING' },
    include: { user: { select: { name: true, lastName: true } } },
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
      id: ci.user.id,
      name: ci.user.name,
      lastName: ci.user.lastName,
      checkInTime: ci.checkInTime,
      reservationEndTime: ci.reservation?.endTime || '',
      service: ci.reservation?.service || 'UNKNOWN',
    })),
    recentReservations: recentReservationsRaw.map(r => ({
      id: r.id,
      user: { name: r.user.name, lastName: r.user.lastName },
      service: r.service,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      reason: r.reason,
    })),
  };
}

export async function getCurrentCheckinsForToday() {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const rows = await prisma.checkIn.findMany({
    where: { checkOutTime: null, checkInTime: { gte: startOfDay } },
    include: {
      user: { select: { id: true, name: true, lastName: true, email: true, dni: true } },
      reservation: { select: { service: true, endTime: true } },
    },
    orderBy: { checkInTime: 'desc' },
  });
  return rows.map(ci => ({
    id: ci.user.id,
    name: ci.user.name,
    lastName: ci.user.lastName,
    email: ci.user.email,
    dni: ci.user.dni,
    checkInTime: ci.checkInTime,
    reservationEndTime: ci.reservation?.endTime || '',
    service: ci.reservation?.service || 'UNKNOWN',
    reservationId: ci.reservationId || '',
  }));
}

export async function checkoutActiveCheckinByUserId(userId: string) {
  const checkIn = await prisma.checkIn.findFirst({
    where: { user: { id: userId }, checkOutTime: null },
  });
  if (!checkIn) return null;
  return prisma.checkIn.update({
    where: { id: checkIn.id },
    data: { checkOutTime: new Date(), updatedAt: new Date() },
    include: {
      user: { select: { name: true, lastName: true, email: true } },
      reservation: { select: { service: true, startTime: true, endTime: true } },
    },
  });
}


