import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { userFeeds } from "@/lib/calendar/user-feeds";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { z } from "zod";

/**
 * Suscripciones de calendario de quien llama (milestone 45).
 *
 * - `GET`: si están encendidas y, en ese caso, los feeds con sus enlaces.
 * - `POST { action }`: `enable` (las enciende), `disable` (las apaga: todos los enlaces dejan de
 *   andar) o `regenerate` (sube la versión: los enlaces viejos dejan de andar y hay que volver a
 *   agregarlos).
 *
 * Los enlaces son credenciales (quien los tiene ve el calendario): solo se le muestran a su dueño.
 */
async function view(
  registeredUserId: string,
  session: Parameters<typeof userFeeds>[2],
) {
  const u = await prisma.registeredUser.findUniqueOrThrow({
    where: { id: registeredUserId },
    select: { calendarFeedEnabled: true, calendarFeedVersion: true },
  });
  return {
    enabled: u.calendarFeedEnabled,
    feeds: u.calendarFeedEnabled
      ? await userFeeds(registeredUserId, u.calendarFeedVersion, session)
      : [],
  };
}

export async function GET() {
  const { session, error } = await requireActiveSession();
  if (error) return error;
  try {
    return apiSuccess(await view(session.userId, session));
  } catch (err) {
    return apiCatch("user/calendar-feeds GET", err);
  }
}

const bodySchema = z.object({
  action: z.enum(["enable", "disable", "regenerate"]),
});

export async function POST(request: NextRequest) {
  const { session, error } = await requireActiveSession();
  if (error) return error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Datos inválidos", 400);
  try {
    const { action } = parsed.data;
    await prisma.registeredUser.update({
      where: { id: session.userId },
      data:
        action === "enable"
          ? { calendarFeedEnabled: true }
          : action === "disable"
            ? { calendarFeedEnabled: false }
            : { calendarFeedVersion: { increment: 1 } },
    });
    return apiSuccess(await view(session.userId, session));
  } catch (err) {
    return apiCatch("user/calendar-feeds POST", err);
  }
}
