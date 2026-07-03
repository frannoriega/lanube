import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/db/adminReservations";
import {
  deleteEvent,
  EventEditDropWarning,
  getEvent,
  updateEvent,
} from "@/lib/db/events";
import {
  eventInputSchema,
  sessionActionSchema,
  sessionActionsNeedReason,
} from "@/lib/schemas/events";
import { serializeJson } from "@/lib/json-bigint";
import { z } from "zod";
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

  const force = body?.force === true;
  const sessionsParsed = z
    .array(sessionActionSchema)
    .safeParse(body?.sessionActions ?? []);
  if (!sessionsParsed.success) {
    return NextResponse.json(
      {
        message: "Cambios de sesión inválidos",
        issues: sessionsParsed.error.issues,
      },
      { status: 400 },
    );
  }

  // Single reason shared by every cancel/reschedule in this save (required when any exist).
  const sessionReason =
    typeof body?.sessionReason === "string" ? body.sessionReason.trim() : "";
  if (sessionActionsNeedReason(sessionsParsed.data) && sessionReason === "") {
    return NextResponse.json(
      { message: "El motivo del cambio de sesiones es obligatorio" },
      { status: 400 },
    );
  }

  try {
    const event = await updateEvent(id, parsed.data, {
      force,
      sessionActions: sessionsParsed.data,
      sessionReason,
    });
    return NextResponse.json(serializeJson(event));
  } catch (e) {
    // Edit would drop per-session changes → ask the admin to confirm (frontend resends force).
    if (e instanceof EventEditDropWarning) {
      return NextResponse.json(
        { message: e.message, dropped: e.dropped },
        { status: 409 },
      );
    }
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
