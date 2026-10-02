import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";
import { decideProfileChangeRequest } from "@/lib/db/profileChangeRequests";
import {
  PROFILE_CHANGE_FIELD_LABELS,
  profileChangeDecisionSchema,
} from "@/lib/schemas/profile";
import { NextRequest } from "next/server";

/** Clave del campo en la foto de auditoría (coincide con los `fields` del evento). */
const AUDIT_FIELD_KEY = { DNI: "dni", REASON_TO_JOIN: "reasonToJoin" } as const;

/**
 * POST: aprobar o rechazar una solicitud de cambio de DNI / motivo (milestone 17).
 * Body: `{ decision: "approve" | "reject", reason? }` — rechazar exige motivo, que el
 * usuario ve en su historial.
 *
 * El admin no elige el valor: aprueba exactamente lo que pidió el usuario. Las reglas
 * (no resolver la propia, solo pendientes, DNI sin dueño) viven en
 * `decideProfileChangeRequest`, que aplica el cambio en la misma transacción.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requirePermission(
      "users:profile-requests:review",
    );
    if (error) return error;

    const parsed = profileChangeDecisionSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Decisión inválida",
        400,
      );
    }

    const { id } = await params;
    const reason = parsed.data.reason?.trim() || null;
    const result = await decideProfileChangeRequest({
      requestId: id,
      deciderId: session.userId,
      decision: parsed.data.decision,
      reason,
    });

    const key = AUDIT_FIELD_KEY[result.field];
    await emitAudit(session, AUDIT_ACTIONS.userProfileChangeDecide, {
      entityId: result.requesterId,
      context: {
        Usuario: result.requesterName,
        Dato: PROFILE_CHANGE_FIELD_LABELS[result.field],
      },
      reason,
      // Aprobada: el diff muestra el dato que cambió. Rechazada: el perfil no cambió, se
      // guarda solo qué se pidió.
      before:
        result.decision === "approve" ? { [key]: result.previousValue } : null,
      after:
        result.decision === "approve"
          ? { decision: "approve", [key]: result.requestedValue }
          : {
              decision: "reject",
              field: result.field,
              requestedValue: result.requestedValue,
            },
    });

    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("admin/profile-requests decision POST", err);
  }
}
