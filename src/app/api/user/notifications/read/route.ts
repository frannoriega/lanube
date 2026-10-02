import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { markNotificationsRead } from "@/lib/db/notifications";
import { NextRequest } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  /** Mark only these ids read; omit (or send `null`) to mark everything read. */
  ids: z.array(z.string()).nullish(),
});

/** POST: mark the signed-in user's own notifications read — all, or a given set of ids. */
export async function POST(request: NextRequest) {
  const { session, error } = await requireActiveSession();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Datos inválidos", 400);
  }

  try {
    await markNotificationsRead(session.userId, parsed.data.ids ?? undefined);
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("user/notifications/read POST", err);
  }
}
