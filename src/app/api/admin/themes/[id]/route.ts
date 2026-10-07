import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import { deleteLandingTheme, updateLandingTheme } from "@/lib/db/landingThemes";
import { serializeJson } from "@/lib/json-bigint";
import { landingThemeInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    const { id } = await params;
    const audit = await beginAudit("LandingTheme", id);
    const theme = await updateLandingTheme(id, parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.themeUpdate);
    // Invalida la caché pública: la landing muestra el tema del día (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.landingThemes);
    return NextResponse.json(serializeJson(theme));
  } catch (err) {
    return apiServerError("admin/themes/[id] PUT", err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("landing-themes:manage");
  if (error) return error;

  try {
    const { id } = await params;
    const audit = await beginAudit("LandingTheme", id);
    await deleteLandingTheme(id);
    await audit.commit(session, AUDIT_ACTIONS.themeDelete);
    // Invalida la caché pública: la landing muestra el tema del día (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.landingThemes);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiServerError("admin/themes/[id] DELETE", err);
  }
}
