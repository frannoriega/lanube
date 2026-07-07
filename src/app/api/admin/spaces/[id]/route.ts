import { requirePermission } from "@/lib/api-auth";
import { deleteSpace, updateSpace } from "@/lib/db/spaces";
import { serializeJson } from "@/lib/json-bigint";
import { spaceInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("spaces:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = spaceInputSchema.safeParse(body);
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
    const space = await updateSpace(id, parsed.data);
    return NextResponse.json(serializeJson(space));
  } catch (e) {
    const message =
      e instanceof Error && e.message.includes("Unique constraint")
        ? "Ya existe un espacio con ese slug"
        : "No se pudo actualizar el espacio";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("spaces:manage");
  if (error) return error;

  const { id } = await params;
  try {
    await deleteSpace(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo eliminar el espacio";
    return NextResponse.json({ message }, { status: 409 });
  }
}
