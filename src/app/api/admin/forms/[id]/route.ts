import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import {
  deleteFormTemplate,
  getFormTemplate,
  updateFormTemplate,
} from "@/modules/events/db/forms";
import { formTemplateSchema } from "@/modules/events/schema";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("forms:manage");
  if (error) return error;

  const { id } = await params;
  const template = await getFormTemplate(id);
  if (!template) {
    return apiError("Formulario no encontrado", 404);
  }
  return apiSuccess(template);
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
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const template = await updateFormTemplate(id, parsed.data);
    return apiSuccess(template);
  } catch (e) {
    return apiCatch("admin/forms/[id] PUT", e);
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
    return apiSuccess({ ok: true });
  } catch (e) {
    return apiCatch("admin/forms/[id] DELETE", e);
  }
}
