import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/db/adminReservations";
import { createEvent, listEvents } from "@/lib/db/events";
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

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const events = await listEvents();
  return NextResponse.json(serializeJson(events));
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Datos inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const event = await createEvent(parsed.data);
    return NextResponse.json(serializeJson(event), { status: 201 });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error interno del servidor";
    return NextResponse.json({ message }, { status: 400 });
  }
}
