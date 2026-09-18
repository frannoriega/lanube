import { requirePermission } from "@/lib/api-auth";
import { deleteLandingTheme, updateLandingTheme } from "@/lib/db/landingThemes";
import { serializeJson } from "@/lib/json-bigint";
import { landingThemeInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("landing-themes:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = landingThemeInputSchema.safeParse(body);
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
    const { id } = await params;
    const theme = await updateLandingTheme(id, parsed.data);
    return NextResponse.json(serializeJson(theme));
  } catch (err) {
    return apiServerError("admin/themes/[id] PUT", err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("landing-themes:manage");
  if (error) return error;

  try {
    const { id } = await params;
    await deleteLandingTheme(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiServerError("admin/themes/[id] DELETE", err);
  }
}
