import { apiCatch } from "@/lib/api/response";
import { requirePermission } from "@/lib/api-auth";
import { createFormTemplate, listFormTemplates } from "@/lib/db/forms";
import { serializeJson } from "@/lib/json-bigint";
import { formTemplateSchema } from "@/lib/schemas/events";
import { NextRequest, NextResponse } from "next/server";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";

export async function GET() {
  try {
    const { error } = await requirePermission("forms:manage");
    if (error) return error;

    const templates = await listFormTemplates();
    return NextResponse.json(serializeJson(templates));
  } catch (err) {
    return apiCatch("admin/forms GET", err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requirePermission("forms:manage");
    if (error) return error;

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

    const audit = await beginAudit("Form", null);
    const template = await createFormTemplate(parsed.data);
    if (template) {
      await audit.commit(session, AUDIT_ACTIONS.formCreate, {
        entityId: template.id,
      });
    }
    return NextResponse.json(serializeJson(template), { status: 201 });
  } catch (err) {
    return apiCatch("admin/forms POST", err);
  }
}
