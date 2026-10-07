import { apiCatch } from "@/lib/api/response";
import {
  EDIT_LINK_GONE_MESSAGE,
  getParticipantByToken,
} from "@/lib/db/participants";
import {
  handleParticipantUpload,
  participantUploadRateLimit,
} from "@/lib/events/participant-upload";
import { ParticipantStatus } from "@/types/prisma";
import { NextRequest, NextResponse } from "next/server";

/** Uploads a file for a FILE field while editing an existing registration (token flow). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    // Primero el límite por IP: sin presupuesto no se toca la base (milestone 25, DB8).
    const limited = await participantUploadRateLimit();
    if (limited) return limited;

    const { token } = await params;
    const participant = await getParticipantByToken(token);
    if (participant.state !== "ok") {
      return NextResponse.json(
        { message: EDIT_LINK_GONE_MESSAGE, code: "EDIT_LINK_GONE" },
        { status: 410 },
      );
    }
    if (
      participant.status === ParticipantStatus.CANCELLED ||
      participant.status === ParticipantStatus.REJECTED
    ) {
      return NextResponse.json(
        { message: "La inscripción ya no puede editarse" },
        { status: 409 },
      );
    }
    return handleParticipantUpload(
      request,
      participant.schema,
      ["events", "participant-uploads"],
      participant.eventId,
    );
  } catch (err) {
    return apiCatch("forms/response/[token]/upload POST", err);
  }
}
