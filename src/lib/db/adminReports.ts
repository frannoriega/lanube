import { prisma } from "@/lib/prisma";
import {
  ADMIN_TIMEZONE,
  dateKeyFromUnixMs,
  enumerateDateKeysInclusive,
  startOfDateKeyMs,
} from "@/lib/admin/admin-timezone";
import { nowMs } from "@/lib/clock";
import { RAW_RETENTION_MONTHS } from "@/lib/constants/retention";
import { TZDate } from "@date-fns/tz";
import type { ResourceStats, DailyStats } from "@/types/stats";
import type {
  PeriodSummary,
  ReportCoverage,
  ReportData,
} from "@/types/stats/report";

export type { ResourceStats };

/**
 * Conteos de ocurrencias por (espacio, estado), ya agregados en la base. Los minutos son de la
 * duración de cada ocurrencia (una reprogramada puede durar distinto que su serie).
 */
type OccurrenceGroup = {
  space: string;
  status: string;
  count: number;
  totalMinutes: number;
  minMinutes: number;
  maxMinutes: number;
};

/** Ocurrencias por día (fecha en la hora del predio) y estado. */
type OccurrenceDay = { day: string; status: string; count: number };

/** Altas de usuarios por día (fecha en la hora del predio). */
type UserDay = { day: string; count: number };

type RangeData = {
  groups: OccurrenceGroup[];
  days: OccurrenceDay[];
  users: UserDay[];
};

/** Mismo redondeo que el `durationStats` anterior aplicaba sobre las filas sueltas. */
function roundedStats(total: number, min: number, max: number, count: number) {
  return {
    total: Math.round(total),
    min: Math.round(min),
    avg: Math.round(total / count),
    max: Math.round(max),
  };
}

/**
 * Lo que un reporte necesita del rango, **contado por ocurrencia** y agregado en SQL
 * (milestone 25, C3 + DB6).
 *
 * - Fuente: `reservation_occurrences()` (migración `20261008110000`), que expande cada serie
 *   recurrente con sus excepciones con la misma regla que el ledger. Antes se filtraba
 *   `reservations.start_time`, que en una recurrente es el inicio de la serie: una semanal creada
 *   hace meses no contaba en el mes actual, y en un reporte valía una sola vez.
 * - Las reservas se cuentan solo desde `rawFromMs` (la retención del detalle crudo). Antes de esa
 *   fecha las series terminadas ya se borraron y solo existen como snapshot mensual; una serie
 *   que cruza el corte sí se seguiría expandiendo hacia atrás, y contarla mezclaría un tramo
 *   parcial con lo que el aviso de `coverage` dice que «no está contado en los totales».
 *   Recortar acá vuelve literal ese aviso. Las altas de usuarios no se podan: no se recortan.
 * - Antes se traían todas las filas del rango y se contaban en JS (un reporte anual = todas las
 *   reservas del año en memoria); ahora vuelven O(espacios × estados) + O(días × estados) filas.
 */
async function fetchRangeData(
  fromMs: number,
  toMs: number,
  rawFromMs: number,
): Promise<RangeData> {
  const resFrom = BigInt(Math.max(fromMs, rawFromMs));
  const resTo = BigInt(toMs);
  const tz = ADMIN_TIMEZONE;
  const hasRawPortion = resFrom <= resTo;

  const [groups, days, users] = await Promise.all([
    hasRawPortion
      ? prisma.$queryRaw<OccurrenceGroup[]>`
          SELECT COALESCE(s.name, 'Unknown') AS space,
                 r.status::text AS status,
                 COUNT(*)::int AS count,
                 SUM(d.minutes)::float8 AS "totalMinutes",
                 MIN(d.minutes)::float8 AS "minMinutes",
                 MAX(d.minutes)::float8 AS "maxMinutes"
          FROM reservation_occurrences(${resFrom}, ${resTo}) o
          JOIN reservations r ON r.id = o.reservation_id
          LEFT JOIN spaces s ON s.id = r.space_id
          CROSS JOIN LATERAL (
            SELECT (o.occurrence_end_time - o.occurrence_start_time) / 60000.0 AS minutes
          ) d
          WHERE r.status <> 'CANCELLED'
          GROUP BY 1, 2`
      : Promise.resolve([]),
    hasRawPortion
      ? prisma.$queryRaw<OccurrenceDay[]>`
          SELECT to_char(to_timestamp(o.occurrence_start_time / 1000.0) AT TIME ZONE ${tz},
                         'YYYY-MM-DD') AS day,
                 r.status::text AS status,
                 COUNT(*)::int AS count
          FROM reservation_occurrences(${resFrom}, ${resTo}) o
          JOIN reservations r ON r.id = o.reservation_id
          WHERE r.status <> 'CANCELLED'
          GROUP BY 1, 2`
      : Promise.resolve([]),
    prisma.$queryRaw<UserDay[]>`
      SELECT to_char(to_timestamp(created_at / 1000.0) AT TIME ZONE ${tz},
                     'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
      FROM registered_users
      WHERE created_at BETWEEN ${BigInt(fromMs)} AND ${resTo}
      GROUP BY 1`,
  ]);
  return { groups, days, users };
}

/** Estado de la base → clave del reporte. CANCELLED no entra (se filtra en la consulta). */
const STATUS_KEYS = {
  APPROVED: "approved",
  PENDING: "pending",
  REJECTED: "rejected",
} as const;

function statusKey(status: string) {
  return STATUS_KEYS[status as keyof typeof STATUS_KEYS];
}

function buildPeriodSummary(
  fromMs: number,
  toMs: number,
  data: RangeData,
): PeriodSummary {
  type Breakdown = { approved: number; pending: number; rejected: number };
  const emptyBreakdown = (): Breakdown => ({
    approved: 0,
    pending: 0,
    rejected: 0,
  });
  const byStatus = emptyBreakdown();
  const perSpace = new Map<string, Breakdown>();
  const perResourceStats: ResourceStats[] = [];
  let approvedCount = 0;
  let approvedTotal = 0;
  let approvedMin = Infinity;
  let approvedMax = -Infinity;

  for (const g of data.groups) {
    const key = statusKey(g.status);
    if (!key) continue;
    if (!perSpace.has(g.space)) perSpace.set(g.space, emptyBreakdown());
    perSpace.get(g.space)![key] += g.count;
    byStatus[key] += g.count;

    // Las duraciones, como antes, solo de las aprobadas.
    if (key === "approved") {
      const stats = roundedStats(
        g.totalMinutes,
        g.minMinutes,
        g.maxMinutes,
        g.count,
      );
      perResourceStats.push({
        resourceType: g.space,
        count: g.count,
        totalMinutes: stats.total,
        minMinutes: stats.min,
        avgMinutes: stats.avg,
        maxMinutes: stats.max,
      });
      approvedCount += g.count;
      approvedTotal += g.totalMinutes;
      approvedMin = Math.min(approvedMin, g.minMinutes);
      approvedMax = Math.max(approvedMax, g.maxMinutes);
    }
  }

  const perResource: PeriodSummary["reservations"]["perResource"] = [
    ...perSpace.entries(),
  ].map(([resourceType, b]) => ({
    resourceType,
    count: b.approved + b.pending + b.rejected,
    byStatus: b,
  }));

  return {
    period: { from: fromMs, to: toMs },
    users: {
      newRegistrations: data.users.reduce((acc, u) => acc + u.count, 0),
    },
    reservations: {
      total: byStatus.approved + byStatus.pending + byStatus.rejected,
      byStatus,
      perResource,
      durationStats: {
        overall:
          approvedCount > 0
            ? roundedStats(
                approvedTotal,
                approvedMin,
                approvedMax,
                approvedCount,
              )
            : null,
        perResource: perResourceStats,
      },
    },
  };
}

function buildDailyStats(
  fromMs: number,
  toMs: number,
  data: RangeData,
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
      cancelled: number;
      newUsers: number;
    }
  >();

  for (const key of enumerateDateKeysInclusive(fromKey, toKey)) {
    dailyMap.set(key, {
      reservations: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      cancelled: 0,
      newUsers: 0,
    });
  }

  for (const d of data.days) {
    const entry = dailyMap.get(d.day);
    const key = statusKey(d.status);
    if (!entry || !key) continue;
    entry.reservations += d.count;
    entry[key] += d.count;
  }

  for (const u of data.users) {
    const entry = dailyMap.get(u.day);
    if (entry) entry.newUsers += u.count;
  }

  return Array.from(dailyMap.entries()).map(([dateKey, stats]) => ({
    dateKey,
    ...stats,
  }));
}

/**
 * Instante más antiguo con detalle crudo garantizado: el primer día del mes que queda
 * RAW_RETENTION_MONTHS meses atrás, en la zona del predio. Se redondea a mes porque la
 * poda es mensual (solo borra meses ya compactados).
 */
export function rawRetentionBoundaryMs(): number {
  const now = new TZDate(nowMs(), ADMIN_TIMEZONE);
  const boundary = new TZDate(
    now.getFullYear(),
    now.getMonth() - RAW_RETENTION_MONTHS,
    1,
    ADMIN_TIMEZONE,
  );
  const y = boundary.getFullYear();
  const m = String(boundary.getMonth() + 1).padStart(2, "0");
  return startOfDateKeyMs(`${y}-${m}-01`);
}

/**
 * Qué parte del rango pedido sigue teniendo detalle crudo, y qué snapshots existen para la
 * parte que ya no.
 *
 * Sin esto el reporte mentiría por omisión: pasada la retención, un rango viejo devuelve
 * cero reservas, que se ve exactamente igual que un período sin actividad.
 */
async function buildCoverage(
  fromMs: number,
  toMs: number,
): Promise<ReportCoverage> {
  const rawFromMs = rawRetentionBoundaryMs();
  const hasPrunedPortion = fromMs < rawFromMs;

  if (!hasPrunedPortion) {
    return { rawFromMs, hasPrunedPortion: false, snapshots: [] };
  }

  const snapshots = await prisma.reportSnapshot.findMany({
    where: {
      type: "MONTHLY",
      fromDate: { lte: dateKeyFromUnixMs(Math.min(toMs, rawFromMs)) },
      toDate: { gte: dateKeyFromUnixMs(fromMs) },
    },
    orderBy: { fromDate: "asc" },
    select: { key: true, fromDate: true, toDate: true },
  });

  return { rawFromMs, hasPrunedPortion: true, snapshots };
}

export async function getReportForRange(
  fromMs: number,
  toMs: number,
  compareFromMs?: number,
  compareToMs?: number,
): Promise<ReportData> {
  const rawFromMs = rawRetentionBoundaryMs();
  const data = await fetchRangeData(fromMs, toMs, rawFromMs);

  const summary = buildPeriodSummary(fromMs, toMs, data);
  const daily = buildDailyStats(fromMs, toMs, data);

  // La comparación se recorta igual que el período principal: lo anterior a la retención no
  // está en el detalle crudo. No tiene `coverage` propia — limitación anterior a este cambio,
  // anotada en el doc del milestone 25.
  let comparison: PeriodSummary | undefined;
  if (compareFromMs != null && compareToMs != null) {
    comparison = buildPeriodSummary(
      compareFromMs,
      compareToMs,
      await fetchRangeData(compareFromMs, compareToMs, rawFromMs),
    );
  }

  const coverage = await buildCoverage(fromMs, toMs);

  return { ...summary, daily, comparison, coverage };
}
