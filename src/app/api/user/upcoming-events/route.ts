import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiSuccess } from "@/lib/api/response";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import { listUserUpcomingEventSessions } from "@/lib/db/userActivity";

/** GET /api/user/upcoming-events — próximas sesiones de los eventos a los que estoy inscripto. */
export async function GET() {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    if (!session.user?.email) return apiSuccess([]);

    const email = await normalizeEmailForIdentityServer(session.user.email);
    return apiSuccess(await listUserUpcomingEventSessions(email));
  } catch (err) {
    return apiCatch("user/upcoming-events GET", err);
  }
}
