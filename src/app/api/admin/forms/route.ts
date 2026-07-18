import { requirePermission } from "@/lib/api-auth";
import {
  createFormTemplate,
  listFormTemplates,
} from "@/modules/events/db/forms";
import { serializeJson } from "@/lib/json-bigint";
import { formTemplateSchema } from "@/modules/events/schema";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { error } = await requirePermission("forms:manage");
  if (error) return error;

  const templates = await listFormTemplates();
  return NextResponse.json(serializeJson(templates));
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission("forms:manage");
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

  const template = await createFormTemplate(parsed.data);
  return NextResponse.json(serializeJson(template), { status: 201 });
}
