import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { listUserReservations } from "@/lib/db/userActivity";
import type { NextRequest } from "next/server";

/**
 * GET /api/user/reservations?when=upcoming|past&page=N — las reservas propias, paginadas, por
 * ocurrencia (milestone 35). `past` es el historial completo (cualquier estado).
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;

    const params = request.nextUrl.searchParams;
    const when = params.get("when");
    if (when !== "upcoming" && when !== "past")
      return apiError("when debe ser upcoming o past", 400);
    const page = Number(params.get("page") ?? "1");

    return apiSuccess(await listUserReservations(session.userId, when, page));
  } catch (err) {
    return apiCatch("user/reservations GET", err);
  }
}
