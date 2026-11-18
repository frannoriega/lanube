import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiSuccess } from "@/lib/api/response";
import { listAvailableEvents } from "@/lib/db/userActivity";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";

/** GET /api/user/events/available — eventos a los que me puedo inscribir (o ir sin inscripción). */
export async function GET() {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    if (!session.user?.email) return apiSuccess([]);
    const email = await normalizeEmailForIdentityServer(session.user.email);
    return apiSuccess(await listAvailableEvents(email));
  } catch (err) {
    return apiCatch("user/events/available GET", err);
  }
}
