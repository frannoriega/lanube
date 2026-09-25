import type { ResourceStats, DurationStats, DailyStats } from "@/types/stats";

type StatusBreakdown = {
  approved: number;
  pending: number;
  rejected: number;
};

type ReservationSummary = {
  total: number;
  byStatus: StatusBreakdown;
  perResource: {
    resourceType: string;
    count: number;
    byStatus: StatusBreakdown;
  }[];
  durationStats: {
    overall: DurationStats | null;
    perResource: ResourceStats[];
  };
};

type PeriodSummary = {
  period: { from: number; to: number }; // Unix ms UTC
  users: { newRegistrations: number };
  reservations: ReservationSummary;
};

/**
 * Qué parte del rango pedido está respaldada por detalle crudo y qué parte ya fue
 * compactada. Ver `src/lib/constants/retention.ts`.
 *
 * Existe para que el reporte no mienta por omisión: el detalle crudo se borra a los
 * RAW_RETENTION_MONTHS meses, así que un rango viejo devolvería cero reservas y se vería
 * igual que un período sin actividad.
 */
type ReportCoverage = {
  /** Instante más antiguo que todavía conserva detalle crudo. */
  rawFromMs: number;
  /** True si parte del rango pedido es anterior a `rawFromMs`. */
  hasPrunedPortion: boolean;
  /** Snapshots mensuales disponibles que cubren la parte podada. */
  snapshots: { key: string; fromDate: string; toDate: string }[];
};

type ReportData = PeriodSummary & {
  daily: DailyStats[];
  comparison?: PeriodSummary;
  coverage: ReportCoverage;
};

export type {
  ReportData,
  ReportCoverage,
  PeriodSummary,
  StatusBreakdown,
  ReservationSummary,
};
