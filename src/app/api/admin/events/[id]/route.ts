import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/db/adminReservations";
import { deleteEvent, getEvent, updateEvent } from "@/lib/db/events";
import { eventInputSchema } from "@/lib/schemas/events";
import { serializeJson } from "@/lib/json-bigint";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin() {
  const session = await auth();
  if (!session?.userId) {
    return {
      error: NextResponse.json({ message: "No autorizado" }, { status: 401 }),
    };
  }
  if (!(await isAdminUser(session.userId))) {
    return {
      error: NextResponse.json({ message: "Acceso denegado" }, { status: 403 }),
    };
  }
  return { session };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const event = await getEvent(id);
  if (!event) {
    return NextResponse.json(
      { message: "Evento no encontrado" },
      { status: 404 },
    );
  }
  return NextResponse.json(serializeJson(event));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const event = await updateEvent(id, parsed.data);
    return NextResponse.json(serializeJson(event));
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error interno del servidor";
    const status = message.includes("no encontrado") ? 404 : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  try {
    await deleteEvent(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error interno del servidor";
    const status = message.includes("no encontrado") ? 404 : 400;
    return NextResponse.json({ message }, { status });
  }
}
