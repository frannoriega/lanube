import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { createEvent, listEvents } from "@/modules/events/db/events";
import { eventInputSchema } from "@/modules/events/schema";
import { serializeJson } from "@/lib/json-bigint";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { error } = await requirePermission("events:manage");
  if (error) return error;

  const events = await listEvents();
  return NextResponse.json(serializeJson(events));
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission("events:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Datos inválidos", 400, { issues: parsed.error.issues });
  }

  try {
    const event = await createEvent(parsed.data);
    return apiSuccess(event, { status: 201 });
  } catch (e) {
    return apiCatch("admin/events POST", e);
  }
}
