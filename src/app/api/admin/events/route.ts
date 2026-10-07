import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { createEvent, listEvents } from "@/lib/db/events";
import { eventInputSchema } from "@/lib/schemas/events";
import { serializeJson } from "@/lib/json-bigint";
import { NextRequest, NextResponse } from "next/server";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";

export async function GET() {
  const { error } = await requirePermission("events:manage");
  if (error) return error;

  const events = await listEvents();
  return NextResponse.json(serializeJson(events));
}

export async function POST(request: NextRequest) {
  const { error, session } = await requirePermission("events:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Datos inválidos", 400, { issues: parsed.error.issues });
  }

  try {
    const audit = await beginAudit("Event", null);
    const event = await createEvent(parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.eventCreate, {
      entityId: event.id,
    });
    // Invalida la caché pública: el sitio público muestra los eventos (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.events);
    return apiSuccess(event, { status: 201 });
  } catch (e) {
    return apiCatch("admin/events POST", e);
  }
}
