import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiSuccess } from "@/lib/api/response";
import {
  listProfileChangeRequestsForAdmin,
  type ProfileChangeStatusFilter,
} from "@/lib/db/profileChangeRequests";
import { NextRequest } from "next/server";

const STATUS_FILTERS: ProfileChangeStatusFilter[] = [
  "PENDING",
  "RESOLVED",
  "ALL",
];

/**
 * GET: cola de solicitudes de cambio de DNI / motivo (milestone 17).
 * Query: `status` (PENDING | RESOLVED | ALL, por defecto PENDING), `page`, `pageSize`.
 */
export async function GET(request: NextRequest) {
  try {
    const { error } = await requirePermission("users:profile-requests:review");
    if (error) return error;

    const params = request.nextUrl.searchParams;
    const rawStatus = params.get("status") as ProfileChangeStatusFilter | null;
    const status =
      rawStatus && STATUS_FILTERS.includes(rawStatus) ? rawStatus : "PENDING";
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number(params.get("pageSize")) || 20),
    );

    const result = await listProfileChangeRequestsForAdmin({
      status,
      page,
      pageSize,
    });
    return apiSuccess({
      ...result,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    });
  } catch (err) {
    return apiCatch("admin/profile-requests GET", err);
  }
}
