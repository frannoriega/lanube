import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";
import { snapshotOrder } from "@/lib/db/auditOrder";
import { reorderLandingThemes } from "@/lib/db/landingThemes";
import { reorderInputSchema } from "@/lib/schemas/reorder";
import { NextRequest } from "next/server";

/**
 * Modo "Reordenar" de los temas del landing (milestone 14): el orden de la lista ES la prioridad (arriba gana); reemplaza el campo numérico "Prioridad".
 * Recibe los ids de arriba hacia abajo y los persiste en una transacción. Se audita como una
 * única entrada sobre el orden en sí (`entityId: "*"`), igual que `space.reorder`.
 */
export async function POST(request: NextRequest) {
  const { error, session } = await requirePermission("landing-themes:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = reorderInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
  }

  try {
    // Fotos con nombre antes y después: la auditoría muestra qué se movió y adónde, no
    // una lista de ids (ver `src/lib/db/auditOrder.ts`).
    const before = await snapshotOrder("LandingTheme");
    await reorderLandingThemes(parsed.data.orderedIds);
    const after = await snapshotOrder("LandingTheme");
    await emitAudit(session, AUDIT_ACTIONS.themeReorder, {
      entityId: "*",
      before: { order: before },
      after: { order: after },
    });
    // Invalida la caché pública: la landing muestra el tema del día (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.landingThemes);
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("admin/themes/reorder POST", err);
  }
}
