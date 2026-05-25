import { prisma } from "@/lib/prisma";
import {
  dateKeyFromUnixMs,
  enumerateDateKeysInclusive,
} from "@/lib/admin/admin-timezone";
import type { ResourceStats, DailyStats } from "@/types/stats";
import type { PeriodSummary, ReportData } from "@/types/stats/report";

export type { ResourceStats };

type ReservationRow = {
  startTime: bigint;
  endTime: bigint;
  status: string;
  resource: { type: string } | null;
};

function durationStats(
  durations: number[],
): { min: number; avg: number; max: number } | null {
  if (!durations.length) return null;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  return { min: Math.round(min), avg: Math.round(avg), max: Math.round(max) };
}

async function fetchRangeData(fromMs: number, toMs: number) {
  const startMs = BigInt(fromMs);
  const endMs = BigInt(toMs);

  return Promise.all([
    prisma.registeredUser.findMany({
      where: { createdAt: { gte: startMs, lte: endMs } },
      select: { createdAt: true },
    }),
    prisma.reservation.findMany({
      where: {
        startTime: { gte: startMs, lte: endMs },
        status: { not: "CANCELLED" },
      },
      select: {
        startTime: true,
        endTime: true,
        status: true,
        resource: { select: { type: true } },
      },
    }),
  ]);
}

function buildPeriodSummary(
  fromMs: number,
  toMs: number,
  users: { createdAt: bigint }[],
  reservations: ReservationRow[],
): PeriodSummary {
  type TypeBucket = {
    approved: number[];
    pending: number[];
    rejected: number[];
  };
  const byType = new Map<string, TypeBucket>();

  for (const r of reservations) {
    const type = r.resource?.type ?? "UNKNOWN";
    if (!byType.has(type))
      byType.set(type, { approved: [], pending: [], rejected: [] });
    const bucket = byType.get(type)!;
    const mins = (Number(r.endTime) - Number(r.startTime)) / 60_000;
    if (r.status === "APPROVED") bucket.approved.push(mins);
    else if (r.status === "PENDING") bucket.pending.push(mins);
    else if (r.status === "REJECTED") bucket.rejected.push(mins);
  }

  const perResource: PeriodSummary["reservations"]["perResource"] = [];
  const perResourceStats: ResourceStats[] = [];

  for (const [resourceType, bucket] of byType.entries()) {
    const total =
      bucket.approved.length + bucket.pending.length + bucket.rejected.length;
    perResource.push({
      resourceType,
      count: total,
      byStatus: {
        approved: bucket.approved.length,
        pending: bucket.pending.length,
        rejected: bucket.rejected.length,
      },
    });
    const stats = durationStats(bucket.approved);
    if (stats) {
      perResourceStats.push({
        resourceType,
        count: bucket.approved.length,
        minMinutes: stats.min,
        avgMinutes: stats.avg,
        maxMinutes: stats.max,
      });
    }
  }

  const approvedCount = reservations.filter(
    (r) => r.status === "APPROVED",
  ).length;
  const pendingCount = reservations.filter(
    (r) => r.status === "PENDING",
  ).length;
  const rejectedCount = reservations.filter(
    (r) => r.status === "REJECTED",
  ).length;

  const approvedDurations = reservations
    .filter((r) => r.status === "APPROVED")
    .map((r) => (Number(r.endTime) - Number(r.startTime)) / 60_000);

  return {
    period: { from: fromMs, to: toMs },
    users: { newRegistrations: users.length },
    reservations: {
      total: reservations.length,
      byStatus: {
        approved: approvedCount,
        pending: pendingCount,
        rejected: rejectedCount,
      },
      perResource,
      durationStats: {
        overall: durationStats(approvedDurations),
        perResource: perResourceStats,
      },
    },
  };
}

function buildDailyStats(
  fromMs: number,
  toMs: number,
  users: { createdAt: bigint }[],
  reservations: ReservationRow[],
): DailyStats[] {
  const fromKey = dateKeyFromUnixMs(fromMs);
  const toKey = dateKeyFromUnixMs(toMs);
  const dailyMap = new Map<
    string,
    {
      reservations: number;
      approved: number;
      pending: number;
      rejected: number;
      newUsers: number;
    }
  >();

  for (const key of enumerateDateKeysInclusive(fromKey, toKey)) {
    dailyMap.set(key, {
      reservations: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      newUsers: 0,
    });
  }

  for (const r of reservations) {
    const key = dateKeyFromUnixMs(Number(r.startTime));
    const entry = dailyMap.get(key);
    if (entry) {
      entry.reservations++;
      if (r.status === "APPROVED") entry.approved++;
      else if (r.status === "PENDING") entry.pending++;
      else if (r.status === "REJECTED") entry.rejected++;
    }
  }

  for (const u of users) {
    const key = dateKeyFromUnixMs(Number(u.createdAt));
    const entry = dailyMap.get(key);
    if (entry) entry.newUsers++;
  }

  return Array.from(dailyMap.entries()).map(([dateKey, stats]) => ({
    dateKey,
    ...stats,
  }));
}

export async function getReportForRange(
  fromMs: number,
  toMs: number,
  compareFromMs?: number,
  compareToMs?: number,
): Promise<ReportData> {
  const [users, reservations] = await fetchRangeData(fromMs, toMs);

  const summary = buildPeriodSummary(fromMs, toMs, users, reservations);
  const daily = buildDailyStats(fromMs, toMs, users, reservations);

  let comparison: PeriodSummary | undefined;
  if (compareFromMs != null && compareToMs != null) {
    const [cmpUsers, cmpReservations] = await fetchRangeData(
      compareFromMs,
      compareToMs,
    );
    comparison = buildPeriodSummary(
      compareFromMs,
      compareToMs,
      cmpUsers,
      cmpReservations,
    );
  }

  return { ...summary, daily, comparison };
}
