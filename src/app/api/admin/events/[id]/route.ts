import { requirePermission } from "@/lib/api-auth";
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
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { z } from "zod";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("events:manage");
  if (error) return error;

  const { id } = await params;
  const event = await getEvent(id);
  if (!event) {
    return apiError("Evento no encontrado", 404);
  }
  return apiSuccess(event);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("events:manage");
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Datos inválidos", 400, { issues: parsed.error.issues });
  }

  const force = body?.force === true;
  const sessionsParsed = z
    .array(sessionActionSchema)
    .safeParse(body?.sessionActions ?? []);
  if (!sessionsParsed.success) {
    return apiError("Cambios de sesión inválidos", 400, {
      issues: sessionsParsed.error.issues,
    });
  }

  // Single reason shared by every cancel/reschedule in this save (required when any exist).
  const sessionReason =
    typeof body?.sessionReason === "string" ? body.sessionReason.trim() : "";
  if (sessionActionsNeedReason(sessionsParsed.data) && sessionReason === "") {
    return apiError("El motivo del cambio de sesiones es obligatorio", 400);
  }

  try {
    const event = await updateEvent(id, parsed.data, {
      force,
      sessionActions: sessionsParsed.data,
      sessionReason,
    });
    return apiSuccess(event);
  } catch (e) {
    // Edit would drop per-session changes → ask the admin to confirm (frontend resends force).
    if (e instanceof EventEditDropWarning) {
      return apiError(e.message, 409, { dropped: e.dropped });
    }
    return apiCatch("admin/events/[id] PUT", e);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("events:manage");
  if (error) return error;

  const { id } = await params;
  try {
    await deleteEvent(id);
    return apiSuccess({ ok: true });
  } catch (e) {
    return apiCatch("admin/events/[id] DELETE", e);
  }
}
