import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import { createLandingTheme, listLandingThemes } from "@/lib/db/landingThemes";
import { serializeJson } from "@/lib/json-bigint";
import { landingThemeInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";

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
  const { error, session } = await requirePermission("landing-themes:manage");
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
    const audit = await beginAudit("LandingTheme", null);
    const theme = await createLandingTheme(parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.themeCreate, {
      entityId: theme.id,
    });
    // Invalida la caché pública: la landing muestra el tema del día (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.landingThemes);
    return NextResponse.json(serializeJson(theme), { status: 201 });
  } catch (err) {
    return apiServerError("admin/themes POST", err);
  }
}
