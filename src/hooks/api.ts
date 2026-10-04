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
  ConnectedAssistantItem,
  PasskeyItem,
  ProfileChangeRequestItem,
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

/** Sentinel spaceId meaning "every space", mapped to `allServices=1` server-side. */
export const ALL_SPACES_ID = "all";

/** Pass `null` while the query params are not ready yet (idle). */
export function useAdminReservationsRange(
  params: { spaceId: string; startMs: number; endMs: number } | null,
): UseApiResult<AdminReservationsRange> {
  const url = params
    ? `/api/admin/reservations?${new URLSearchParams({
        ...(params.spaceId === ALL_SPACES_ID
          ? { allServices: "1" }
          : { service: params.spaceId }),
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

/** Historial de solicitudes de cambio de DNI / motivo del usuario (milestone 17). */
export function useOwnProfileChangeRequests(): UseApiResult<
  ProfileChangeRequestItem[]
> {
  return useApi<ProfileChangeRequestItem[]>(
    "/api/user/profile/change-requests",
  );
}

/** Asistentes conectados por MCP y la URL a pegar en el asistente (milestone 20). */
export function useConnectedAssistants(): UseApiResult<{
  assistants: ConnectedAssistantItem[];
  mcpUrl: string;
}> {
  return useApi<{ assistants: ConnectedAssistantItem[]; mcpUrl: string }>(
    "/api/user/assistants",
  );
}

/** Passkeys del usuario y el máximo permitido (milestone 17). */
export function usePasskeys(): UseApiResult<{
  passkeys: PasskeyItem[];
  max: number;
}> {
  return useApi<{ passkeys: PasskeyItem[]; max: number }>("/api/user/passkeys");
}
