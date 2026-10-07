import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import {
  deleteEvent,
  EventCapacityWarning,
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
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { describeSessionActions } from "@/lib/events/session-audit";

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
  const { error, session } = await requirePermission("events:manage");
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Datos inválidos", 400, { issues: parsed.error.issues });
  }

  const force = body?.force === true;
  // Separado de `force` a propósito: confirman cosas distintas (sesiones que se pierden vs.
  // sobrecupo), y confirmar una no debe confirmar la otra en silencio.
  const forceCapacity = body?.forceCapacity === true;
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
    const audit = await beginAudit("Event", id);
    const event = await updateEvent(id, parsed.data, {
      force,
      forceCapacity,
      sessionActions: sessionsParsed.data,
      sessionReason,
    });
    await audit.commit(session, AUDIT_ACTIONS.eventUpdate, {
      // Las sesiones canceladas/reprogramadas en este guardado no están en la foto del
      // evento: se agregan aparte, así la entrada dice qué fechas se tocaron y por qué.
      extra: sessionsParsed.data.length
        ? { after: { sessions: describeSessionActions(sessionsParsed.data) } }
        : undefined,
      reason: sessionReason || null,
    });
    // Invalida la caché pública: el sitio público muestra los eventos (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.events);
    return apiSuccess(event);
  } catch (e) {
    // Edit would drop per-session changes → ask the admin to confirm (frontend resends force).
    if (e instanceof EventEditDropWarning) {
      return apiError(e.message, 409, { dropped: e.dropped });
    }
    // La edición deja más inscriptos que lugares → confirmar (el frontend reenvía
    // forceCapacity).
    if (e instanceof EventCapacityWarning) {
      return apiError(e.message, 409, {
        capacityWarning: { registered: e.registered, capacity: e.capacity },
      });
    }
    return apiCatch("admin/events/[id] PUT", e);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("events:manage");
  if (error) return error;

  const { id } = await params;
  try {
    const audit = await beginAudit("Event", id);
    await deleteEvent(id);
    // Soft delete: the event, its form and participant history survive.
    await audit.commit(session, AUDIT_ACTIONS.eventDelete);
    // Invalida la caché pública: el sitio público muestra los eventos (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.events);
    return apiSuccess({ ok: true });
  } catch (e) {
    return apiCatch("admin/events/[id] DELETE", e);
  }
}
