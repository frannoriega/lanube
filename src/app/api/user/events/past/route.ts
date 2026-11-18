import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiSuccess } from "@/lib/api/response";
import { listUserPastEvents } from "@/lib/db/userActivity";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import type { NextRequest } from "next/server";

/** GET /api/user/events/past?page=N — historial de eventos terminados, paginado. */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    if (!session.user?.email)
      return apiSuccess({ items: [], page: 1, pageSize: 10, total: 0 });
    const email = await normalizeEmailForIdentityServer(session.user.email);
    return apiSuccess(await listUserPastEvents(email, page));
  } catch (err) {
    return apiCatch("user/events/past GET", err);
  }
}
