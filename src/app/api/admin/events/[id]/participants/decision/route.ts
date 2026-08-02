import { requirePermission } from "@/lib/api-auth";
import { decideParticipants } from "@/lib/db/participants";
import { notifyParticipantsDecision } from "@/lib/email/event-decision";
import { participantDecisionSchema } from "@/lib/schemas/events";
import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.json(
      { message: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
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

    return NextResponse.json({
      ok: true,
      decided: participants.length,
      emailed: sent,
      emailFailed: failed,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error interno del servidor";
    return NextResponse.json({ message }, { status: 400 });
  }
}
