import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { listCheckInParticipants } from "@/lib/db/event-checkin";
import { NextRequest } from "next/server";

/**
 * Las inscripciones de un evento con su ingreso a una sesión (`?session=<ms>`) y los totales
 * de esa sesión (milestone 30). Es la lista «Ver inscriptos» de la pantalla de la puerta.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("events:checkin");
  if (error) return error;
  const session = Number(request.nextUrl.searchParams.get("session"));
  if (!Number.isInteger(session) || session <= 0) {
    return apiError("Sesión inválida", 400);
  }
  try {
    const { id } = await params;
    return apiSuccess(await listCheckInParticipants(id, session));
  } catch (e) {
    return apiCatch("admin/events/[id]/checkin/participants GET", e);
  }
}
