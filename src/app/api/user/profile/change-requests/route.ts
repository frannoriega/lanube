import { requireActiveSession } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import {
  createProfileChangeRequest,
  listOwnProfileChangeRequests,
} from "@/lib/db/profileChangeRequests";
import { profileChangeRequestSchema } from "@/lib/schemas/profile";
import { NextRequest } from "next/server";

/**
 * Solicitudes de cambio de DNI / motivo del propio usuario (milestone 17).
 *
 * No se auditan en `audit_logs`: la auditoría registra lo que hace el **equipo** desde el
 * panel (`/api/admin/**`), y la solicitud en sí ya es un registro durable con su autor y su
 * fecha. Lo que sí se audita es la decisión del admin.
 */

/** GET: historial del propio usuario (pendientes y resueltas). */
export async function GET() {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;
    return apiSuccess(await listOwnProfileChangeRequests(session.userId));
  } catch (err) {
    return apiCatch("user/profile/change-requests GET", err);
  }
}

/** POST: pedir un cambio. Body: `{ field, requestedValue, justification }`. */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireActiveSession();
    if (error) return error;

    const parsed = profileChangeRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Solicitud inválida",
        400,
      );
    }

    const created = await createProfileChangeRequest(
      session.userId,
      parsed.data,
    );
    return apiSuccess(created, { status: 201 });
  } catch (err) {
    return apiCatch("user/profile/change-requests POST", err);
  }
}
