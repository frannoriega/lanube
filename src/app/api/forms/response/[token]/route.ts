import {
  cancelParticipant,
  getParticipantByToken,
  updateParticipantAnswers,
} from "@/modules/events/db/participants";
import { participantEditSchema } from "@/modules/events/schema";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const participant = await getParticipantByToken(token);
  if (!participant) {
    return NextResponse.json({ message: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json(participant);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const parsed = participantEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Datos inválidos" }, { status: 400 });
  }

  const result = await updateParticipantAnswers(token, parsed.data.answers);
  if (!result.ok) {
    if (result.errors) {
      return NextResponse.json(
        { message: "Revisá los campos", errors: result.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: result.message ?? "No se pudo actualizar" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const result = await cancelParticipant(token);
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message ?? "No encontrado" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
