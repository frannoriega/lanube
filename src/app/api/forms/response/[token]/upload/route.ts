import { getParticipantByToken } from "@/modules/events/db/participants";
import { handleParticipantUpload } from "@/modules/events/lib/participant-upload";
import { ParticipantStatus } from "@/types/prisma";
import { NextRequest, NextResponse } from "next/server";

/** Uploads a file for a FILE field while editing an existing registration (token flow). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const participant = await getParticipantByToken(token);
  if (!participant) {
    return NextResponse.json(
      { message: "Inscripción no encontrada" },
      { status: 404 },
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
  return handleParticipantUpload(request, participant.schema, [
    "events",
    "participant-uploads",
  ]);
}
