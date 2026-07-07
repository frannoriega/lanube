import { requirePermission } from "@/lib/api-auth";
import {
  deleteFormTemplate,
  getFormTemplate,
  updateFormTemplate,
} from "@/lib/db/forms";
import { serializeJson } from "@/lib/json-bigint";
import { formTemplateSchema } from "@/lib/schemas/events";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("forms:manage");
  if (error) return error;

  const { id } = await params;
  const template = await getFormTemplate(id);
  if (!template) {
    return NextResponse.json(
      { message: "Formulario no encontrado" },
      { status: 404 },
    );
  }
  return NextResponse.json(serializeJson(template));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("forms:manage");
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = formTemplateSchema.safeParse(body);
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
    const template = await updateFormTemplate(id, parsed.data);
    return NextResponse.json(serializeJson(template));
  } catch (e) {
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
  const { error } = await requirePermission("forms:manage");
  if (error) return error;

  const { id } = await params;
  try {
    await deleteFormTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error interno del servidor";
    const status = message.includes("no encontrado") ? 404 : 400;
    return NextResponse.json({ message }, { status });
  }
}
