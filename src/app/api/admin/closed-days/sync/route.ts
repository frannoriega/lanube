import { apiCatch, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/api-auth";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";
import { syncNationalHolidays } from "@/lib/db/holidaySync";

/**
 * «Sincronizar ahora»: la misma sincronización del cron mensual, a pedido. Solo propone
 * feriados nacionales (`PENDING_REVIEW`); no confirma nada.
 */
export async function POST() {
  try {
    const { error, session } = await requirePermission("closed-days:manage");
    if (error) return error;

    const summary = await syncNationalHolidays();
    await emitAudit(session, AUDIT_ACTIONS.closedDaySync, {
      entityId: "national-holidays",
      after: {
        created: summary.created,
        refreshed: summary.refreshed,
        missing: summary.missing.length,
        failedYears: summary.failedYears.join(", ") || "ninguno",
      },
    });
    return apiSuccess(summary);
  } catch (err) {
    return apiCatch("admin/closed-days/sync POST", err);
  }
}
