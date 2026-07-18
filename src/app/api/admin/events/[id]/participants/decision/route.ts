import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { decideParticipants } from "@/modules/events/db/participants";
import { notifyParticipantsDecision } from "@/lib/email/event-decision";
import { logger } from "@/lib/logger";
import { participantDecisionSchema } from "@/modules/events/schema";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("events:manage");
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
