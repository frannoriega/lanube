"use client";

/**
 * Typed hooks for the internal JSON API, one per GET endpoint.
 * Pages with page-specific queries (users table, reports) build their URL
 * locally and call `useApi` directly with their own response type.
 */

import type { SpaceOption } from "@/components/molecules/admin-resource-type-combobox";
import {
  parseItemsByDateFromApi,
  type AdminReservationListResult,
} from "@/lib/api/admin-reservations";
import { useApi, type UseApiResult } from "@/hooks/use-api";
import type {
  AdminStats,
  CheckedInUser,
  Incident,
  UserDashboardStats,
  UserProfile,
} from "@/types/api";

export function useAdminStats(): UseApiResult<AdminStats> {
  return useApi<AdminStats>("/api/admin/stats");
}

export function useSpaceOptions(): UseApiResult<SpaceOption[]> {
  return useApi<SpaceOption[]>("/api/spaces");
}

export type AdminReservationsRange = {
  itemsByDate: Record<string, AdminReservationListResult[]>;
  fromKey: string;
  toKey: string;
};

/** Pass `null` while the query params are not ready yet (idle). */
export function useAdminReservationsRange(
  params: { spaceId: string; startMs: number; endMs: number } | null,
): UseApiResult<AdminReservationsRange> {
  const url = params
    ? `/api/admin/reservations?${new URLSearchParams({
        service: params.spaceId,
        startDate: String(params.startMs),
        endDate: String(params.endMs),
      }).toString()}`
    : null;
  return useApi<AdminReservationsRange>(url, {
    parse: parseItemsByDateFromApi,
  });
}

export function useCheckedInUsers(): UseApiResult<CheckedInUser[]> {
  return useApi<CheckedInUser[]>("/api/admin/checkin/current", {
    refreshIntervalMs: 30_000,
  });
}

export function useIncidents(): UseApiResult<Incident[]> {
  return useApi<Incident[]>("/api/admin/incidents");
}

export function useUserStats(): UseApiResult<UserDashboardStats> {
  return useApi<UserDashboardStats>("/api/user/stats");
}

export function useUserProfile(): UseApiResult<UserProfile> {
  return useApi<UserProfile>("/api/user/profile");
}
