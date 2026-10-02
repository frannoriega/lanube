import { requirePermission } from "@/lib/api-auth";
import { apiError, apiServerError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";
import { checkoutActiveCheckinByUserId } from "@/lib/db/adminStats";
import { NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Was `auth()` + `isAdminByEmail()`, which only asks "can this person enter /admin".
    // Since roles became data (milestone 9) that is true for any admin-panel role — a
    // Comunicador could check people out. This route needs its own permission, like
    // every other admin mutation.
    const { error, session } = await requirePermission("checkin:manage");
    if (error) return error;

    const { action } = await request.json().catch(() => ({ action: null }));

    if (!action || !["checkout"].includes(action)) {
      return apiError("Acción inválida", 400);
    }

    const { id } = await params;

    const updated = await checkoutActiveCheckinByUserId(id);
    if (!updated) {
      return apiError("Check-in no encontrado o ya cerrado", 404);
    }

    // Check-outs are higher-frequency than the rest of the trail, but "who closed this
    // person's session, and when" is exactly the kind of operational question the audit
    // exists to answer. The view filters by action and entity type, so the volume does
    // not drown anything.
    await recordAuditFromSession(session, {
      action: AUDIT_ACTIONS.checkinUpdate,
      entityType: "CheckIn",
      entityId: updated.id,
      context: {
        Usuario: `${updated.registeredUser.name} ${updated.registeredUser.lastName}`,
        ...(updated.reservation?.space?.name
          ? { Espacio: updated.reservation.space.name }
          : {}),
      },
      before: { checkOutTime: null },
      after: { checkOutTime: Number(updated.checkOutTime ?? 0) },
    });

    return apiSuccess(updated);
  } catch (error) {
    return apiServerError("admin/checkin/[id]", error);
  }
}
