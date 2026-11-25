import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";
import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { registerWalkIn } from "@/lib/db/event-checkin";
import { walkInSchema } from "@/lib/schemas/checkin";
import { NextRequest } from "next/server";

/**
 * Registra a alguien que llegó **sin inscripción** (milestone 30): el admin completa el
 * formulario del evento y la persona queda inscripta (`WALK_IN`, aprobada) con su ingreso a la
 * sesión. Sin chequear cupo y sin correo (decisiones del usuario).
 *
 * Respuestas: 200 con la inscripción; 400 con `errors` por campo si el formulario no valida;
 * 409 con `existing` si el email ya tiene una inscripción en el evento.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("events:checkin");
  if (error) return error;
  const { id } = await params;
  const parsed = walkInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
  }
  try {
    const { session: occurrenceStart, email, answers } = parsed.data;
    const res = await registerWalkIn(
      id,
      occurrenceStart,
      email,
      answers,
      session.userId,
    );
    if (!res.ok) {
      if ("errors" in res) {
        return apiError("Revisá el formulario", 400, { errors: res.errors });
      }
      return apiError("Ese email ya tiene una inscripción en el evento", 409, {
        existing: res.existing,
      });
    }
    const { participant, session: checkInSession, eventName } = res.result;
    await emitAudit(session, AUDIT_ACTIONS.participantWalkIn, {
      entityId: id,
      context: { Evento: eventName, Participante: participant.displayEmail },
      after: {
        participant: participant.displayEmail,
        participantId: participant.id,
        session: checkInSession.startMs,
        // Milestone 34: quienes entraron con esta inscripción (el equipo, si lo hay).
        ...(participant.members.length > 1
          ? { members: participant.members.map((m) => m.displayEmail) }
          : {}),
      },
    });
    // Ocupa un lugar: cambia el «quedan N» de las tarjetas públicas.
    revalidatePublic(PUBLIC_TAGS.events);
    return apiSuccess({ participant });
  } catch (e) {
    return apiCatch("admin/events/[id]/checkin/walk-in POST", e);
  }
}
