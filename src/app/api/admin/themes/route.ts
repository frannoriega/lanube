import { requirePermission } from "@/lib/api-auth";
import { createLandingTheme, listLandingThemes } from "@/lib/db/landingThemes";
import { serializeJson } from "@/lib/json-bigint";
import { landingThemeInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";

export async function GET() {
  const { error } = await requirePermission("landing-themes:manage");
  if (error) return error;

  try {
    const themes = await listLandingThemes();
    return NextResponse.json(serializeJson(themes));
  } catch (err) {
    return apiServerError("admin/themes GET", err);
  }
}

export async function POST(request: NextRequest) {
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
    const theme = await createLandingTheme(parsed.data);
    return NextResponse.json(serializeJson(theme), { status: 201 });
  } catch (err) {
    return apiServerError("admin/themes POST", err);
  }
}
