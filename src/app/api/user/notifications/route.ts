import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiSuccess } from "@/lib/api/response";
import { serializeJson } from "@/lib/json-bigint";
import { listNotificationsForUser } from "@/lib/db/notifications";

/** GET: the signed-in user's recent notifications (bell dropdown) + unread count. */
export async function GET() {
  const { session, error } = await requireActiveSession();
  if (error) return error;
  try {
    const result = await listNotificationsForUser(session.userId);
    return apiSuccess(serializeJson(result));
  } catch (err) {
    return apiCatch("user/notifications GET", err);
  }
}
