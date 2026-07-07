import { requirePermission } from "@/lib/api-auth";
import { createResource, listResources } from "@/lib/db/resources";
import { serializeJson } from "@/lib/json-bigint";
import { resourceInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";

// Physical resources (equipment inventory). The event-form space picker moved to
// /api/admin/spaces?reservable=1.
export async function GET() {
  const { error } = await requirePermission("admin:access");
  if (error) return error;

  const resources = await listResources();
  return NextResponse.json(serializeJson(resources));
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission("resources:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = resourceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.issues[0]?.message ?? "Datos inválidos",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const resource = await createResource(parsed.data);
    return NextResponse.json(serializeJson(resource), { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "Ya existe un recurso con ese número de serie" },
      { status: 400 },
    );
  }
}
