import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";
import { listFeaturedNewsPosts, reorderFeaturedNewsPosts } from "@/lib/db/news";
import { reorderInputSchema } from "@/lib/schemas/reorder";
import { NextRequest } from "next/server";

/**
 * Noticias destacadas en el orden actual del landing. Requiere `news:approve`: el orden de
 * las destacadas es una decisión de portada que afecta notas de todos los autores.
 */
export async function GET() {
  const { error } = await requirePermission("news:approve");
  if (error) return error;
  try {
    return apiSuccess(await listFeaturedNewsPosts());
  } catch (err) {
    return apiCatch("admin/news/featured-order GET", err);
  }
}

/**
 * Modo "Reordenar destacadas" de noticias (milestone 14): reemplaza "Orden entre destacadas" del formulario. Requiere `news:approve`.
 * Recibe los ids de arriba hacia abajo y los persiste en una transacción. Se audita como una
 * única entrada sobre el orden en sí (`entityId: "*"`), igual que `space.reorder`.
 */
export async function POST(request: NextRequest) {
  const { error, session } = await requirePermission("news:approve");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = reorderInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
  }

  try {
    await reorderFeaturedNewsPosts(parsed.data.orderedIds);
    await recordAuditFromSession(session, {
      action: AUDIT_ACTIONS.newsFeaturedReorder,
      entityType: "NewsPost",
      entityId: "*",
      after: { orderedIds: parsed.data.orderedIds },
    });
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("admin/news/featured-order POST", err);
  }
}
