import { AdminReservationListResult } from "@/components/templates/admin/dashboard-recent-reservations";
import {
  dateKeyFromUnixMs,
  enumerateDateKeysInclusive,
} from "@/lib/admin/admin-timezone";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ReservationStatus } from "@/generated/prisma/client";

const MAX_PAGE_SIZE = 100;
const RANGE_FETCH_MAX = 3000;

/** Default forward window length for admin reservation views (days, inclusive of today). */
export const ADMIN_RESERVATION_FORWARD_DAYS = 14;

type ReservationAdminRow = Prisma.ReservationGetPayload<{
  include: {
    space: true;
    registeredUser: {
      select: {
        name: true;
        lastName: true;
        dni: true;
        institution: true;
        user: { select: { email: true; displayEmail: true } };
      };
    };
  };
}>;

async function actorSizeByReservationId(
  reservations: { id: string; startTime: bigint }[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (reservations.length === 0) return result;

  const ids = [...new Set(reservations.map((r) => r.id))];
  const ledgerRows = await prisma.reservationLedger.findMany({
    where: { reservationId: { in: ids } },
    select: {
      reservationId: true,
      occurrenceStartTime: true,
      actorSize: true,
    },
  });

  for (const res of reservations) {
    const start = Number(res.startTime);
    const exact = ledgerRows.find(
      (l) =>
        l.reservationId === res.id && Number(l.occurrenceStartTime) === start,
    );
    if (exact) {
      result.set(res.id, exact.actorSize);
      continue;
    }
    const anyFor = ledgerRows.filter((l) => l.reservationId === res.id);
    result.set(res.id, anyFor[0]?.actorSize ?? 1);
  }

  return result;
}

function toAdminReservationListResult(
  row: ReservationAdminRow,
  actorSize: number,
): AdminReservationListResult {
  return {
    id: row.id,
    startTime: Number(row.startTime),
    endTime: Number(row.endTime),
    reason: row.reason,
    status: row.status,
    createdAt: Number(row.createdAt),
    deniedReason: row.deniedReason,
    actorSize,
    resource: {
      id: row.space?.id ?? "",
      name: row.space?.name ?? "",
      capacity: row.space?.capacity ?? 1,
      isExclusive: row.space?.isExclusive ?? false,
      spaceName: row.space?.name ?? "",
    },
    registeredUser: row.registeredUser,
  };
}

async function mapRowsToAdminResults(
  rows: ReservationAdminRow[],
): Promise<AdminReservationListResult[]> {
  const sizes = await actorSizeByReservationId(
    rows.map((r) => ({ id: r.id, startTime: r.startTime })),
  );
  return rows.map((r) => toAdminReservationListResult(r, sizes.get(r.id) ?? 1));
}

export async function approveReservationAndRejectConflicts(
  id: string,
): Promise<{ approvedId: string; autoRejectedIds: string[] }> {
  await prisma.$executeRaw`SELECT approve_reservation(${id}::text)`;
  return { approvedId: id, autoRejectedIds: [] };
}

export async function previewConflictingPending(): Promise<string[]> {
  return [];
}

export async function setReservationStatus(
  id: string,
  status: ReservationStatus,
  deniedReason?: string,
) {
  return prisma.reservation.update({
    where: { id },
    data: {
      status,
      ...(deniedReason ? { deniedReason } : {}),
    },
  });
}

export interface ListAdminReservationsOptions {
  startMs?: number;
  endMs?: number;
  status?: ReservationStatus;
  page?: number;
  pageSize?: number;
}

export interface ListAdminReservationsResult {
  items: AdminReservationListResult[];
  total: number;
}

const reservationAdminInclude = {
  space: true,
  registeredUser: {
    select: {
      name: true,
      lastName: true,
      dni: true,
      institution: true,
      user: { select: { email: true, displayEmail: true } },
    },
  },
} as const;

export async function listAdminReservationsBySpace(
  spaceId: string,
  options?: ListAdminReservationsOptions,
): Promise<ListAdminReservationsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options?.pageSize ?? 50),
  );

  const where: Prisma.ReservationWhereInput = { spaceId };

  if (options?.startMs != null && options?.endMs != null) {
    where.startTime = {
      gte: BigInt(options.startMs),
      lte: BigInt(options.endMs),
    };
  }

  if (options?.status) {
    where.status = options.status;
  }

  const [rows, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: reservationAdminInclude,
      orderBy: { startTime: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  const items = await mapRowsToAdminResults(rows);
  return { items, total };
}

/** All reservations for a space in [startMs, endMs], every status. */
export async function listAllAdminReservationsInDateRange(
  spaceId: string,
  startMs: number,
  endMs: number,
): Promise<AdminReservationListResult[]> {
  const where: Prisma.ReservationWhereInput = {
    spaceId,
    startTime: {
      gte: BigInt(startMs),
      lte: BigInt(endMs),
    },
  };

  const rows = await prisma.reservation.findMany({
    where,
    include: reservationAdminInclude,
    orderBy: { startTime: "asc" },
    take: RANGE_FETCH_MAX,
  });

  return mapRowsToAdminResults(rows);
}

/** All reservations in [startMs, endMs] across every space. */
export async function listAllAdminReservationsAllServicesInDateRange(
  startMs: number,
  endMs: number,
): Promise<AdminReservationListResult[]> {
  const where: Prisma.ReservationWhereInput = {
    startTime: {
      gte: BigInt(startMs),
      lte: BigInt(endMs),
    },
  };

  const rows = await prisma.reservation.findMany({
    where,
    include: reservationAdminInclude,
    orderBy: { startTime: "asc" },
    take: RANGE_FETCH_MAX,
  });

  return mapRowsToAdminResults(rows);
}

export async function listAdminReservationsAllServicesByRange(
  startMs: number,
  endMs: number,
  options?: { status?: ReservationStatus; page?: number; pageSize?: number },
): Promise<ListAdminReservationsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options?.pageSize ?? 50),
  );

  const where: Prisma.ReservationWhereInput = {
    startTime: {
      gte: BigInt(startMs),
      lte: BigInt(endMs),
    },
  };
  if (options?.status) {
    where.status = options.status;
  }

  const [rows, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: reservationAdminInclude,
      orderBy: { startTime: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  const items = await mapRowsToAdminResults(rows);
  return { items, total };
}

export function groupAdminReservationsByDateKey(
  items: AdminReservationListResult[],
  keysInOrder: string[],
): Record<string, AdminReservationListResult[]> {
  const buckets: Record<string, AdminReservationListResult[]> = {};
  for (const k of keysInOrder) {
    buckets[k] = [];
  }
  for (const item of items) {
    const k = dateKeyFromUnixMs(item.startTime);
    if (buckets[k]) {
      buckets[k].push(item);
    }
  }
  return buckets;
}

export interface DayWithReservations {
  date: string;
  count: number;
}

export interface ListDaysWithReservationsOptions {
  page?: number;
  pageSize?: number;
}

export interface ListDaysWithReservationsResult {
  items: DayWithReservations[];
  total: number;
}

/** Per-day reservation counts for a space in [startMs, endMs]. */
export async function listReservationDayCountsInRange(
  spaceId: string,
  status: ReservationStatus | undefined,
  startMs: number,
  endMs: number,
): Promise<ListDaysWithReservationsResult> {
  const fromKey = dateKeyFromUnixMs(startMs);
  const toKey = dateKeyFromUnixMs(endMs);
  const keys = enumerateDateKeysInclusive(fromKey, toKey);

  const where: Prisma.ReservationWhereInput = {
    spaceId,
    startTime: { gte: BigInt(startMs), lte: BigInt(endMs) },
  };
  if (status) where.status = status;

  const rows = await prisma.reservation.findMany({
    where,
    select: { startTime: true },
  });

  const counts: Record<string, number> = {};
  for (const k of keys) counts[k] = 0;
  for (const r of rows) {
    const k = dateKeyFromUnixMs(Number(r.startTime));
    if (k in counts) counts[k] += 1;
  }

  const items = keys.map((date) => ({ date, count: counts[date] }));
  return { items, total: items.length };
}

export async function listDaysWithPendingReservationsAllServices(
  startMs: number,
  endMs: number,
  options?: ListDaysWithReservationsOptions,
): Promise<ListDaysWithReservationsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options?.pageSize ?? 50),
  );

  const rows = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      startTime: { gte: BigInt(startMs), lte: BigInt(endMs) },
    },
    select: { startTime: true },
    orderBy: { startTime: "asc" },
  });

  const byDay = rows.reduce<Record<string, number>>((acc, r) => {
    const key = dateKeyFromUnixMs(Number(r.startTime));
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const allDays = Object.entries(byDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const total = allDays.length;
  const items = allDays.slice((page - 1) * pageSize, page * pageSize);
  return { items, total };
}
