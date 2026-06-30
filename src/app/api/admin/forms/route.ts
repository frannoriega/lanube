import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/db/adminReservations";
import { createFormTemplate, listFormTemplates } from "@/lib/db/forms";
import { serializeJson } from "@/lib/json-bigint";
import { formTemplateSchema } from "@/lib/schemas/events";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin() {
  const session = await auth();
  if (!session?.userId) {
    return {
      error: NextResponse.json({ message: "No autorizado" }, { status: 401 }),
    };
  }
  if (!(await isAdminUser(session.userId))) {
    return {
      error: NextResponse.json({ message: "Acceso denegado" }, { status: 403 }),
    };
  }
  return { session };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const templates = await listFormTemplates();
  return NextResponse.json(serializeJson(templates));
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
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
