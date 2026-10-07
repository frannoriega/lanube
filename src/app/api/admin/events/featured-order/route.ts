import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";
import { snapshotOrder } from "@/lib/db/auditOrder";
import { listFeaturedEvents, reorderFeaturedEvents } from "@/lib/db/events";
import { reorderInputSchema } from "@/lib/schemas/reorder";
import { NextRequest } from "next/server";

/** Eventos destacados en el orden actual del landing, para abrir el modo "Reordenar destacados". */
export async function GET() {
  const { error } = await requirePermission("events:manage");
  if (error) return error;
  try {
    return apiSuccess(await listFeaturedEvents());
  } catch (err) {
    return apiCatch("admin/events/featured-order GET", err);
  }
}

/**
 * Modo "Reordenar destacados" de eventos (milestone 14): reemplaza el campo "Orden entre destacados" del formulario.
 * Recibe los ids de arriba hacia abajo y los persiste en una transacción. Se audita como una
 * única entrada sobre el orden en sí (`entityId: "*"`), igual que `space.reorder`.
 */
export async function POST(request: NextRequest) {
  const { error, session } = await requirePermission("events:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = reorderInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
  }

  try {
    // Fotos con nombre antes y después: la auditoría muestra qué se movió y adónde, no
    // una lista de ids (ver `src/lib/db/auditOrder.ts`).
    const before = await snapshotOrder("Event");
    await reorderFeaturedEvents(parsed.data.orderedIds);
    const after = await snapshotOrder("Event");
    await emitAudit(session, AUDIT_ACTIONS.eventFeaturedReorder, {
      entityId: "*",
      before: { order: before },
      after: { order: after },
    });
    // Invalida la caché pública: el sitio público muestra los eventos (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.events);
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("admin/events/featured-order POST", err);
  }
}
