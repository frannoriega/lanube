import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { nowMs } from "@/lib/clock";
import { windowState } from "@/lib/maintenance/evaluate";
import {
  getMaintenanceWindow,
  toView,
  updateMaintenanceWindow,
} from "@/lib/maintenance/server";
import { maintenanceInputSchema } from "@/lib/schemas/maintenance";
import { NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("maintenance:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = maintenanceInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400, {
      issues: parsed.error.issues,
    });
  }

  try {
    const { id } = await params;
    const current = await getMaintenanceWindow(id);
    if (!current) return apiError("Mantenimiento no encontrado", 404);
    // Una ventana terminada es historia: no se reescribe.
    if (windowState(toView(current), nowMs()) === "ended") {
      return apiError("Un mantenimiento terminado ya no se puede editar", 409);
    }
    const audit = await beginAudit("MaintenanceWindow", id);
    const row = await updateMaintenanceWindow(id, parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.maintenanceUpdate);
    return apiSuccess(toView(row));
  } catch (err) {
    return apiCatch("admin/maintenance/[id] PUT", err);
  }
}
