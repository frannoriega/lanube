import { prisma } from "@/lib/prisma";

export type ResourceStats = {
  resourceType: string;
  count: number;
  minMinutes: number;
  avgMinutes: number;
  maxMinutes: number;
};

export type ReportData = {
  period: { from: number; to: number }; // Unix ms UTC
  users: { newRegistrations: number };
  reservations: {
    total: number;
    perResource: { resourceType: string; count: number }[];
    durationStats: {
      overall: { min: number; avg: number; max: number } | null;
      perResource: ResourceStats[];
    };
  };
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

export async function getReportForRange(
  fromMs: number,
  toMs: number,
): Promise<ReportData> {
  const startMs = BigInt(fromMs);
  const endMs = BigInt(toMs);

  const [newRegistrations, reservations] = await Promise.all([
    prisma.registeredUser.count({
      where: { createdAt: { gte: startMs, lte: endMs } },
    }),
    prisma.reservation.findMany({
      where: {
        status: "APPROVED",
        startTime: { gte: startMs, lte: endMs },
      },
      select: {
        startTime: true,
        endTime: true,
        resource: { select: { type: true } },
      },
    }),
  ]);

  // Group durations (in minutes) by resource type
  const byType = new Map<string, number[]>();
  for (const r of reservations) {
    const type = r.resource?.type ?? "UNKNOWN";
    const mins = (Number(r.endTime) - Number(r.startTime)) / 60_000;
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(mins);
  }

  const perResource: { resourceType: string; count: number }[] = [];
  const perResourceStats: ResourceStats[] = [];

  for (const [resourceType, durations] of byType.entries()) {
    perResource.push({ resourceType, count: durations.length });
    const stats = durationStats(durations);
    if (stats) {
      perResourceStats.push({
        resourceType,
        count: durations.length,
        minMinutes: stats.min,
        avgMinutes: stats.avg,
        maxMinutes: stats.max,
      });
    }
  }

  const allDurations = reservations.map(
    (r) => (Number(r.endTime) - Number(r.startTime)) / 60_000,
  );

  return {
    period: { from: fromMs, to: toMs },
    users: { newRegistrations },
    reservations: {
      total: reservations.length,
      perResource,
      durationStats: {
        overall: durationStats(allDurations),
        perResource: perResourceStats,
      },
    },
  };
}
