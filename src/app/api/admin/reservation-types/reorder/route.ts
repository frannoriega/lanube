import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";
import { snapshotOrder } from "@/lib/db/auditOrder";
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
    // Fotos con nombre antes y después: la auditoría muestra qué se movió y adónde, no
    // una lista de ids (ver `src/lib/db/auditOrder.ts`).
    const before = await snapshotOrder("ReservationType");
    await reorderReservationTypes(parsed.data.orderedIds);
    const after = await snapshotOrder("ReservationType");
    await emitAudit(session, AUDIT_ACTIONS.reservationTypeReorder, {
      entityId: "*",
      before: { order: before },
      after: { order: after },
    });
    // Invalida la caché pública: las tarjetas de eventos muestran el nombre del tipo (milestone 25, P2).
    revalidatePublic(PUBLIC_TAGS.events);
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("admin/reservation-types/reorder POST", err);
  }
}
