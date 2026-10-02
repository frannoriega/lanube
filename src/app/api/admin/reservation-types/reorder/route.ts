import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";
import { reorderReservationTypes } from "@/lib/db/reservationTypes";
import { reorderInputSchema } from "@/lib/schemas/reorder";
import { NextRequest } from "next/server";

/**
 * Modo "Reordenar" de los tipos de reserva (milestone 14): reemplaza el campo numérico "Orden".
 * Recibe los ids de arriba hacia abajo y los persiste en una transacción. Se audita como una
 * única entrada sobre el orden en sí (`entityId: "*"`), igual que `space.reorder`.
 */
export async function POST(request: NextRequest) {
  const { error, session } = await requirePermission(
    "reservation-types:manage",
  );
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = reorderInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
  }

  try {
    await reorderReservationTypes(parsed.data.orderedIds);
    await recordAuditFromSession(session, {
      action: AUDIT_ACTIONS.reservationTypeReorder,
      entityType: "ReservationType",
      entityId: "*",
      after: { orderedIds: parsed.data.orderedIds },
    });
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("admin/reservation-types/reorder POST", err);
  }
}
