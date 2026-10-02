import { requirePermission } from "@/lib/api-auth";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { deleteResource, updateResource } from "@/lib/db/resources";
import { serializeJson } from "@/lib/json-bigint";
import { resourceInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission("resources:manage");
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

  const { id } = await params;
  try {
    const audit = await beginAudit("Resource", id);
    const resource = await updateResource(id, parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.resourceUpdate);
    return NextResponse.json(serializeJson(resource));
  } catch {
    return NextResponse.json(
      { message: "No se pudo actualizar el recurso" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission("resources:manage");
  if (error) return error;

  const { id } = await params;
  try {
    const audit = await beginAudit("Resource", id);
    await deleteResource(id);
    await audit.commit(session, AUDIT_ACTIONS.resourceDelete);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "No se pudo eliminar el recurso" },
      { status: 400 },
    );
  }
}
