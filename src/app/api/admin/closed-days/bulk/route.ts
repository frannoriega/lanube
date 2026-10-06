import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { setClosedDayStatus } from "@/lib/db/closedDays";
import { closedDayBulkSchema } from "@/lib/schemas/closed-days";
import type { BulkActionResult } from "@/lib/schemas/bulk";
import { createId } from "@paralleldrive/cuid2";
import { NextRequest } from "next/server";

/**
 * Confirmar o descartar en lote las propuestas de feriados (milestone 23). Cada cierre tocado
 * deja **su propia** entrada de auditoría (`closedDay.update`, con el cambio de estado), todas
 * con el mismo `requestId`, igual que las acciones en lote de eventos y noticias.
 *
 * Solo se confirma lo que está pendiente de revisión, y solo se descarta lo pendiente o
 * activo: lo demás se saltea con un motivo en lugar de fallar el lote.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requirePermission("closed-days:manage");
    if (error) return error;

    const body = await request.json().catch(() => null);
    const parsed = closedDayBulkSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Datos inválidos",
        400,
      );
    }
    const { ids, action } = parsed.data;
    const requestId = createId();
    const result: BulkActionResult = { done: 0, skipped: [] };

    for (const id of ids) {
      const audit = await beginAudit("ClosedDay", id);
      const outcome = await setClosedDayStatus(
        id,
        action === "confirm" ? "ACTIVE" : "DISMISSED",
      );
      if (outcome !== "changed") {
        result.skipped.push({
          id,
          reason:
            outcome === "not_found"
              ? "Ya no existe"
              : action === "confirm"
                ? "No estaba pendiente de revisión"
                : "Ya estaba descartado",
        });
        continue;
      }
      await audit.commit(session, AUDIT_ACTIONS.closedDayUpdate, { requestId });
      result.done++;
    }
    return apiSuccess(result);
  } catch (err) {
    return apiCatch("admin/closed-days/bulk POST", err);
  }
}
