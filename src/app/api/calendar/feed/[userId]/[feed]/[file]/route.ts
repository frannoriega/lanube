import type { NextRequest } from "next/server";
import {
  feedRateLimited,
  icsResponse,
  notFound,
  signatureFromFile,
} from "@/lib/calendar/feed-response";
import {
  isUserFeedKind,
  verifyUserFeedSignature,
} from "@/lib/calendar/feed-token";
import {
  eventsFeedIcs,
  reservationsFeedIcs,
  spaceFeedIcs,
} from "@/lib/db/calendarFeeds";
import { getPermissionSetForUser } from "@/lib/db/roles";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

/**
 * Suscripción de calendario de una persona (milestone 45): `GET
 * /api/calendar/feed/<registeredUserId>/<feed>/<firma>.ics`, con `feed` = `reservations`,
 * `events` o `space-<spaceId>`. Público a propósito (lo lee Google sin sesión): la firma HMAC es
 * la credencial (`src/lib/calendar/feed-token.ts`). Responde 404 sin distinguir por qué falló.
 *
 * Se comprueba **en cada lectura** que las suscripciones estén encendidas, que la firma sea de la
 * versión vigente y, para los de espacio, que la persona tenga hoy `reservations:manage` (el mismo
 * permiso que el calendario de actividades del admin): si pierde el rol, el feed queda vacío.
 */
export async function GET(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ userId: string; feed: string; file: string }> },
) {
  const { userId, feed, file } = await params;
  const signature = signatureFromFile(file);
  if (!signature || !isUserFeedKind(feed)) return notFound();
  try {
    const user = await prisma.registeredUser.findUnique({
      where: { id: userId },
      select: { calendarFeedEnabled: true, calendarFeedVersion: true },
    });
    if (
      !user?.calendarFeedEnabled ||
      !verifyUserFeedSignature(
        userId,
        feed,
        user.calendarFeedVersion,
        signature,
      )
    )
      return notFound();
    if (await feedRateLimited(`calendar:${userId}`)) {
      return new Response("Demasiadas solicitudes", { status: 429 });
    }

    if (feed === "reservations")
      return icsResponse(await reservationsFeedIcs(userId), "mis-reservas.ics");
    if (feed === "events")
      return icsResponse(await eventsFeedIcs(userId), "mis-eventos.ics");

    const perms = await getPermissionSetForUser(userId);
    if (!hasPermission(perms?.permissions, "reservations:manage"))
      return notFound();
    const ics = await spaceFeedIcs(feed.slice("space-".length));
    return ics ? icsResponse(ics, `${feed}.ics`) : notFound();
  } catch (err) {
    logger.error("calendar feed failed", err);
    return new Response("Error", { status: 500 });
  }
}
