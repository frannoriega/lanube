import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { decideParticipants } from "@/lib/db/participants";
import { notifyParticipantsDecision } from "@/lib/email/event-decision";
import { logger } from "@/lib/logger";
import { participantDecisionSchema } from "@/lib/schemas/events";
import { NextRequest } from "next/server";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("events:manage");
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = participantDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Datos inválidos", 400, { issues: parsed.error.issues });
  }

  const { participantIds, decision, reason } = parsed.data;

  try {
    const { eventName, participants } = await decideParticipants(
      id,
      participantIds,
      decision,
      reason ?? null,
    );

    // One entry for the batch, keyed to the event: a decision covering 40 people should
    // not produce 40 rows. The participant ids live in the payload.
    await emitAudit(session, AUDIT_ACTIONS.participantDecide, {
      entityId: id,
      context: {
        Evento: eventName,
        Inscriptos: `${participants.length} persona(s)`,
      },
      after: {
        decision,
        participantIds,
        decided: participants.length,
      },
      reason: reason?.trim() || null,
    });

    // Notify affected participants only after the write commits (mirrors session-change notices).
    const { sent, failed } = await notifyParticipantsDecision(
      eventName,
      decision,
      reason?.trim() || null,
      participants,
    );

    if (failed > 0) {
      logger.warn("participant decision emails partially failed", {
        eventId: id,
        decision,
        sent,
        failed,
      });
    }

    return apiSuccess({
      ok: true,
      decided: participants.length,
      emailed: sent,
      emailFailed: failed,
    });
  } catch (e) {
    return apiCatch("admin/events/[id]/participants/decision POST", e);
  }
}
