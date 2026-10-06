import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { nowMs } from "@/lib/clock";
import { windowState } from "@/lib/maintenance/evaluate";
import {
  endMaintenanceWindow,
  getMaintenanceWindow,
  toView,
} from "@/lib/maintenance/server";
import { NextRequest } from "next/server";

/** "Finalizar ahora": corta la ventana (vigente o programada) y la deja en el historial. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("maintenance:manage");
  if (error) return error;

  try {
    const { id } = await params;
    const current = await getMaintenanceWindow(id);
    if (!current) return apiError("Mantenimiento no encontrado", 404);
    if (windowState(toView(current), nowMs()) === "ended") {
      return apiError("Este mantenimiento ya terminó", 409);
    }
    const audit = await beginAudit("MaintenanceWindow", id);
    const row = await endMaintenanceWindow(id);
    await audit.commit(session, AUDIT_ACTIONS.maintenanceEnd);
    return apiSuccess(toView(row));
  } catch (err) {
    return apiCatch("admin/maintenance/[id]/end POST", err);
  }
}
