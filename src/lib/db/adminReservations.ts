import { AdminReservationListResult } from "@/components/templates/admin/dashboard-recent-reservations";
import {
  dateKeyFromUnixMs,
  enumerateDateKeysInclusive,
} from "@/lib/admin/admin-timezone";
import { DomainError } from "@/lib/errors";
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

/**
 * Traduce las fallas de precondición de `approve_reservation()` (milestone-12 D3) a mensajes
 * seguros para el usuario. La función se niega a promover una reserva que ya no entra en el
 * espacio tal como está ahora — el lugar puede haberse ocupado entre la creación y la
 * aprobación (un evento nuevo, otra aprobación, una capacidad reducida), y antes de que
 * existiera la precondición aprobar simplemente fabricaba un sobrecupo.
 */
function translateApprovalError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.includes("Approval conflict: space taken")) {
      throw new DomainError(
        "El espacio ya está ocupado en ese horario — la reserva no puede aprobarse",
        409,
      );
    }
    if (error.message.includes("Approval conflict: capacity exceeded")) {
      throw new DomainError(
        "No queda capacidad en el espacio para ese horario — la reserva no puede aprobarse",
        409,
      );
    }
    if (error.message.includes("Approval conflict: actor already approved")) {
      throw new DomainError(
        "Quien reserva ya tiene una reserva aprobada en otro espacio en ese horario",
        409,
      );
    }
  }
  throw error;
}

/**
 * Approves a reservation and lets `approve_reservation()` reject whatever it conflicts
 * with — one admin click can cascade into rejecting other people's reservations.
 *
 * The SQL function has always RETURNED those ids (`auto_rejected_ids`, a comma-separated
 * text column), but this helper called it through `$executeRaw`, which yields a row count
 * and discards the result set — so the cascade was invisible to the app and the audit
 * trail had nothing to attribute. `$queryRaw` reads them properly.
 *
 * Desde la slice B del milestone-12 la función además rechaza la aprobación de plano cuando
 * la reserva ya no entra — ver {@link translateApprovalError}.
 */
export async function approveReservationAndRejectConflicts(
  id: string,
): Promise<{ approvedId: string; autoRejectedIds: string[] }> {
  const rows = await prisma.$queryRaw<
    Array<{ approved_id: string | null; auto_rejected_ids: string | null }>
  >`SELECT * FROM approve_reservation(${id}::text)`.catch(
    translateApprovalError,
  );

  const raw = rows[0]?.auto_rejected_ids ?? "";
  const autoRejectedIds = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== id);

  return { approvedId: rows[0]?.approved_id ?? id, autoRejectedIds };
}

/**
 * Las reservas que aprobar `id` rechazaría automáticamente, sin aprobar nada.
 *
 * Era un stub que devolvía `[]` (con el id de la reserva comentado en su único call site), así
 * que la pantalla de confirmación del admin siempre decía "esto no afecta a nadie" y después
 * la aprobación rechazaba reservas de otras personas y les mandaba mail (milestone-12 D15).
 *
 * `preview_approval_conflicts()` replica en solo lectura los dos loops de cascada de
 * `approve_reservation()`, con el mismo chequeo de capacidad `peak_space_usage` que usa el
 * camino de escritura. Las dos viven contiguas en
 * `20260924150000_actor_size_and_approval_preview` a propósito: la falla que hay que evitar es
 * que la vista previa y la acción se separen.
 */
export async function previewConflictingPending(id: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ reservation_id: string }[]>`
    SELECT reservation_id FROM preview_approval_conflicts(${id}::text)
  `;
  return [...new Set(rows.map((r) => r.reservation_id))].filter(
    (value) => value !== id,
  );
}

/**
 * Cambia el estado de una reserva (rechazar / cancelar — aprobar pasa por
 * `approveReservationAndRejectConflicts`).
 *
 * Las filas correspondientes de `reservation_ledger` las actualiza el trigger
 * `sync_reservation_ledger_status` (migración `20260924100000_ledger_integrity`), **no** esta
 * función. No agregar una escritura manual al ledger: el trigger cubre a todos los writers, y
 * antes de que existiera esta función dejaba en APPROVED las filas del ledger de una reserva
 * cancelada, así que el espacio quedaba ocupado para siempre (milestone-12 D1).
 */
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
