import { requirePermission } from "@/lib/api-auth";
import { apiError, apiServerError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import {
  createMaintenanceWindow,
  listMaintenanceWindows,
  toView,
} from "@/lib/maintenance/server";
import { maintenanceInputSchema } from "@/lib/schemas/maintenance";
import { NextRequest } from "next/server";

export async function GET() {
  const { error } = await requirePermission("maintenance:manage");
  if (error) return error;
  try {
    return apiSuccess(await listMaintenanceWindows());
  } catch (err) {
    return apiServerError("admin/maintenance GET", err);
  }
}

export async function POST(request: NextRequest) {
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
    const audit = await beginAudit("MaintenanceWindow", null);
    const row = await createMaintenanceWindow(parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.maintenanceCreate, {
      entityId: row.id,
    });
    return apiSuccess(toView(row), { status: 201 });
  } catch (err) {
    return apiServerError("admin/maintenance POST", err);
  }
}
