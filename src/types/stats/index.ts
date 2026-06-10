type DurationStats = { total: number; min: number; avg: number; max: number };

type ResourceStats = {
  resourceType: string;
  count: number;
  totalMinutes: number;
  minMinutes: number;
  avgMinutes: number;
  maxMinutes: number;
};

type DailyStats = {
  dateKey: string; // YYYY-MM-DD in admin TZ
  reservations: number;
  approved: number;
  pending: number;
  rejected: number;
  cancelled: number;
  newUsers: number;
};

export type { DurationStats, ResourceStats, DailyStats };
