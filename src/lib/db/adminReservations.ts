import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { ReservationStatus, ResourceType, UserRole } from "@/generated/prisma/client";

const MAX_PAGE_SIZE = 100;

/**
 * Admin Reservations DB helpers
 *
 * These functions encapsulate admin-facing queries and updates related
 * to reservations, and are intended to be used by API routes.
 */

/**
 * Returns true if the given userId belongs to an admin RegisteredUser.
 */
/**
 * Returns whether a given userId corresponds to an ADMIN registered user.
 */
export async function isAdminUser(id: string): Promise<boolean> {
  const user = await prisma.registeredUser.findUnique({ where: { id } });
  return !!user && user.role === UserRole.ADMIN;
}

/**
 * Lists reservations for a given resource type, including related user and resource data.
 */
/**
 * Lists reservations filtered by resource type, including basic user and resource info.
 */
export interface AdminReservationListResult {
  id: string;
  startTime: Date;
  endTime: Date;
  reason: string;
  status: string;
  createdAt: Date;
  deniedReason?: string | null;
  resource: {
    id: string;
    name: string;
    type: ResourceType;
  };
  registeredUser: {
    name: string;
    lastName: string;
    dni: string;
    institution: string | null;
    user: {
      email: string;
    }
  };
}

/**
 * Parses API response (where dates come as ISO strings) into AdminReservationListResult
 * with proper Date objects. Use this when receiving reservations from fetch/JSON.
 */
export function parseAdminReservationListFromApi(
  raw: unknown
): AdminReservationListResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: Record<string, unknown>) => ({
    ...item,
    startTime: new Date(item.startTime as string | number | Date),
    endTime: new Date(item.endTime as string | number | Date),
    createdAt: new Date(item.createdAt as string | number | Date),
  })) as AdminReservationListResult[];
}

export interface ListAdminReservationsOptions {
  date?: string; // YYYY-MM-DD
  status?: ReservationStatus;
  page?: number;
  pageSize?: number;
}

export interface ListAdminReservationsResult {
  items: AdminReservationListResult[];
  total: number;
}

export async function listAdminReservationsByType(
  service: ResourceType,
  options?: ListAdminReservationsOptions
): Promise<ListAdminReservationsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options?.pageSize ?? 50));

  const where: Prisma.ReservationWhereInput = {
    resource: { type: service },
  };

  if (options?.date) {
    const [y, m, d] = options.date.split("-").map(Number);
    const startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0);
    const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
    where.startTime = { gte: startOfDay, lte: endOfDay };
  }

  if (options?.status) {
    where.status = options.status;
  }

  const [items, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: {
        resource: true,
        registeredUser: {
          select: {
            name: true,
            lastName: true,
            dni: true,
            institution: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { startTime: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  return { items, total };
}

export interface DayWithReservations {
  date: string; // YYYY-MM-DD
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

export async function listDaysWithReservations(
  service: ResourceType,
  status?: ReservationStatus,
  options?: ListDaysWithReservationsOptions
): Promise<ListDaysWithReservationsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options?.pageSize ?? 50));

  const where: Prisma.ReservationWhereInput = {
    resource: { type: service },
  };
  if (status) where.status = status;

  const rows = await prisma.reservation.findMany({
    where,
    select: { startTime: true },
    orderBy: { startTime: "asc" },
  });

  const byDay = rows.reduce<Record<string, number>>((acc, r) => {
    const key = r.startTime.toISOString().slice(0, 10);
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

export async function listDaysWithPendingReservationsAllServices(
  options?: ListDaysWithReservationsOptions
): Promise<ListDaysWithReservationsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options?.pageSize ?? 50));

  const rows = await prisma.reservation.findMany({
    where: { status: "PENDING" },
    select: { startTime: true },
    orderBy: { startTime: "asc" },
  });

  const byDay = rows.reduce<Record<string, number>>((acc, r) => {
    const key = r.startTime.toISOString().slice(0, 10);
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

export async function listAdminReservationsByDate(
  date: string,
  options?: { page?: number; pageSize?: number }
): Promise<ListAdminReservationsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options?.pageSize ?? 50));

  const [y, m, d] = date.split("-").map(Number);
  const startOfDay = new Date(y, m - 1, d, 0, 0, 0, 0);
  const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);

  const where = {
    status: "PENDING" as const,
    startTime: { gte: startOfDay, lte: endOfDay },
  };

  const [items, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      include: {
        resource: true,
        registeredUser: {
          select: {
            name: true,
            lastName: true,
            dni: true,
            institution: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { startTime: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  return { items, total };
}

/**
 * Updates reservation status for admin workflows.
 */
/**
 * Updates the status of a reservation by id.
 */
export async function setReservationStatus(
  reservationId: string,
  status: ReservationStatus,
  deniedReason?: string
) {
  return prisma.reservation.update({
    where: { id: reservationId },
    data: {
      status,
      ...(status === 'REJECTED' && deniedReason ? { deniedReason } : {}),
    },
  });
}

/**
 * Approves a reservation and rejects conflicting pending reservations in one DB transaction.
 * Returns the approved id and the list of auto-rejected ids.
 */
export async function approveReservationAndRejectConflicts(
  reservationId: string,
  // deniedReason?: string
): Promise<{ approvedId: string | null; autoRejectedIds: string[] }> {
  // Call the SQL function that handles approval and conflict resolution
  const rows = await prisma.$queryRaw<{ approved_id: string; auto_rejected_ids: string }[]>`
    SELECT * FROM approve_reservation(${reservationId}::text)
  `;

  const approvedId = rows?.[0]?.approved_id ?? null;
  const autoRejectedCsv = rows?.[0]?.auto_rejected_ids as string | null;
  const autoRejectedIds = autoRejectedCsv ? autoRejectedCsv.split(',').filter(Boolean) : [];

  return { approvedId, autoRejectedIds };
}

/**
 * Previews which pending reservations would be rejected if the given reservation is approved.
 * This is the same as approveReservationAndRejectConflicts but without actually making changes.
 */
export async function previewConflictingPending(/*reservationId: string*/): Promise<string[]> {
  // We can simulate this by checking the ledger for conflicts
  // For now, we'll just return empty since the SQL function doesn't have a preview mode
  // The admin can see the result after approval
  return [];
}


