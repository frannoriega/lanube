import type { NextRequest } from "next/server";
import {
  feedRateLimited,
  icsResponse,
  notFound,
  signatureFromFile,
} from "@/lib/calendar/feed-response";
import { verifyRegistrationFeedSignature } from "@/lib/calendar/feed-token";
import { registrationFeedIcs } from "@/lib/db/calendarFeeds";
import { logger } from "@/lib/logger";

/**
 * Suscripción al calendario de **una inscripción** (milestone 45): el enlace «Agregar a mi
 * calendario» del correo de confirmación. Funciona sin cuenta. La firma HMAC del id de la
 * inscripción es la credencial; solo muestra las sesiones de ese evento (se actualiza sola si
 * alguna cambia) y no permite modificar nada.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ participantId: string; file: string }> },
) {
  const { participantId, file } = await params;
  const signature = signatureFromFile(file);
  if (!signature || !verifyRegistrationFeedSignature(participantId, signature))
    return notFound();
  try {
    if (await feedRateLimited(`calendar-reg:${participantId}`)) {
      return new Response("Demasiadas solicitudes", { status: 429 });
    }
    const ics = await registrationFeedIcs(participantId);
    return ics ? icsResponse(ics, "evento.ics") : notFound();
  } catch (err) {
    logger.error("registration calendar feed failed", err);
    return new Response("Error", { status: 500 });
  }
}
