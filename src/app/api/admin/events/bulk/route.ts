import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { deleteEvent, setEventsFeatured } from "@/lib/db/events";
import { prisma } from "@/lib/prisma";
import { bulkActionSchema, type BulkActionResult } from "@/lib/schemas/bulk";
import { createId } from "@paralleldrive/cuid2";
import { NextRequest } from "next/server";

/**
 * Acciones en lote sobre eventos (milestone 16): cancelar, destacar o quitar de destacados
 * los eventos marcados en la lista.
 *
 * Cada evento tocado deja **su propia** entrada de auditoría (`event.delete` /
 * `event.update`, con el diff de lo que cambió), todas con el mismo `requestId`: en
 * `/admin/audit` se leen como una sola operación, pero cada evento conserva su historia.
 *
 * Cancelar es la misma baja lógica que el botón del evento (`deleteEvent`): libera las
 * reservas y conserva formulario e inscriptos. Un evento ya cancelado se saltea.
 */
export async function POST(request: NextRequest) {
  const { error, session } = await requirePermission("events:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = bulkActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
  }
  const { ids, action } = parsed.data;
  const requestId = createId();
  const result: BulkActionResult = { done: 0, skipped: [] };

  try {
    if (action === "delete") {
      const live = await prisma.event.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true },
      });
      const liveIds = new Set(live.map((e) => e.id));
      for (const id of ids) {
        if (!liveIds.has(id)) {
          result.skipped.push({ id, reason: "Ya estaba cancelado" });
          continue;
        }
        const audit = await beginAudit("Event", id);
        await deleteEvent(id);
        await audit.commit(session, AUDIT_ACTIONS.eventDelete, { requestId });
        result.done++;
      }
      // Invalida la caché pública: el sitio público muestra los eventos (milestone 25, P2).
      revalidatePublic(PUBLIC_TAGS.events);
      return apiSuccess(result);
    }

    // Destacar / quitar: una foto por evento antes de escribir, para el diff de cada uno.
    const audits = await Promise.all(ids.map((id) => beginAudit("Event", id)));
    const changed = new Set(await setEventsFeatured(ids, action === "feature"));
    for (const [i, id] of ids.entries()) {
      if (!changed.has(id)) {
        result.skipped.push({
          id,
          reason:
            action === "feature"
              ? "Ya estaba destacado o está cancelado"
              : "No estaba destacado",
        });
        continue;
      }
      await audits[i].commit(session, AUDIT_ACTIONS.eventUpdate, { requestId });
      result.done++;
    }
    // Invalida la caché pública: el sitio público muestra los eventos (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.events);
    return apiSuccess(result);
  } catch (err) {
    return apiCatch("admin/events/bulk POST", err);
  }
}
