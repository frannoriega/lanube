import type { ResourceStats, DurationStats, DailyStats } from "@/types/stats";

type StatusBreakdown = {
  approved: number;
  pending: number;
  rejected: number;
  cancelled: number;
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

type ReportData = PeriodSummary & {
  daily: DailyStats[];
  comparison?: PeriodSummary;
};

export type { ReportData, PeriodSummary, StatusBreakdown, ReservationSummary };
