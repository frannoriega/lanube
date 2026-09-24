import { requirePermission } from "@/lib/api-auth";
import {
  deleteLandingTheme,
  getLandingTheme,
  updateLandingTheme,
} from "@/lib/db/landingThemes";

/** Fields worth a before/after entry; the rest are presentation detail. */
const AUDITED_THEME_FIELDS = [
  "name",
  "isEnabled",
  "priority",
  "startDate",
  "endDate",
] as const;
import { serializeJson } from "@/lib/json-bigint";
import { landingThemeInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";
import { diffFields } from "@/lib/audit/diff";

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
    const before = await getLandingTheme(id);
    const theme = await updateLandingTheme(id, parsed.data);
    const diff = before
      ? diffFields(before, theme, [...AUDITED_THEME_FIELDS])
      : null;
    await recordAuditFromSession(session, {
      action: AUDIT_ACTIONS.themeUpdate,
      entityType: "LandingTheme",
      entityId: id,
      ...(diff ?? { after: { name: theme.name } }),
    });
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
    const before = await getLandingTheme(id);
    await deleteLandingTheme(id);
    await recordAuditFromSession(session, {
      action: AUDIT_ACTIONS.themeDelete,
      entityType: "LandingTheme",
      entityId: id,
      before: before
        ? { name: before.name, isEnabled: before.isEnabled }
        : null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiServerError("admin/themes/[id] DELETE", err);
  }
}
