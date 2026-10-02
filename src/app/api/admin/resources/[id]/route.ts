import { requirePermission } from "@/lib/api-auth";
import { diffFields } from "@/lib/audit/diff";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";
import { deleteResource, updateResource } from "@/lib/db/resources";
import { serializeJson } from "@/lib/json-bigint";
import { prisma } from "@/lib/prisma";
import { resourceInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";

const AUDITED_RESOURCE_FIELDS = ["name", "serialNumber"] as const;

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
    const before = await prisma.resource.findUnique({
      where: { id },
      select: { name: true, serialNumber: true },
    });
    const resource = await updateResource(id, parsed.data);
    if (before) {
      const diff = diffFields(before, resource, [...AUDITED_RESOURCE_FIELDS]);
      if (diff) {
        await recordAuditFromSession(session, {
          action: AUDIT_ACTIONS.resourceUpdate,
          entityType: "Resource",
          entityId: id,
          context: { Recurso: resource.name },
          ...diff,
        });
      }
    }
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
    const before = await prisma.resource.findUnique({
      where: { id },
      select: { name: true },
    });
    await deleteResource(id);
    if (before) {
      await recordAuditFromSession(session, {
        action: AUDIT_ACTIONS.resourceDelete,
        entityType: "Resource",
        entityId: id,
        before: { name: before.name },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "No se pudo eliminar el recurso" },
      { status: 400 },
    );
  }
}
