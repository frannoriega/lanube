import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";
import { nowMs } from "@/lib/clock";
import {
  getInviteeEvent,
  inviteesToSend,
  markInvited,
} from "@/lib/db/eventInvitees";
import { sendEventInvitation } from "@/lib/email/event-invitation";
import { areEventEmailsSuspended } from "@/lib/maintenance/server";
import { NextRequest } from "next/server";
import { z } from "zod";

/**
 * Manda la invitación por correo (milestone 43), con `events:manage`.
 *
 * `{ ids }` manda (o reenvía) a esos invitados; sin `ids`, a los que **nunca** la recibieron. Cada
 * envío exitoso registra `invitedAt` en el momento, así una tanda cortada a la mitad no se repite
 * entera. Respeta el área de mantenimiento `event-emails` (no manda y lo dice).
 *
 * Se manda en el pedido, como el resto de los correos de eventos (`TODO(scale)` en
 * `notifyEventParticipantsBatch`): con listas de cientos conviene pasarlo a una cola. Por eso el
 * tope por llamada; la pantalla puede volver a llamar para el resto.
 */
const MAX_PER_CALL = 200;

const bodySchema = z.object({
  ids: z.array(z.string()).min(1).max(MAX_PER_CALL).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, session } = await requirePermission("events:manage");
  if (error) return error;
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError("Datos inválidos", 400);

  try {
    const event = await getInviteeEvent(id);
    if (event.deletedAt != null)
      return apiError("El evento está cancelado", 409);
    if (!event.form)
      return apiError(
        "El evento no tiene formulario de inscripción: no hay a dónde invitar",
        409,
      );
    if (event.status !== "PUBLISHED")
      return apiError(
        "Publicá el evento antes de mandar invitaciones: el enlace todavía no funciona",
        409,
      );
    if (await areEventEmailsSuspended())
      return apiError(
        "Los correos de eventos están suspendidos por mantenimiento",
        503,
      );

    const targets = (await inviteesToSend(id, parsed.data.ids)).slice(
      0,
      MAX_PER_CALL,
    );
    const sentTo: string[] = [];
    let failed = 0;
    for (const t of targets) {
      const ok = await sendEventInvitation(t.displayEmail, {
        name: event.name,
        summary: event.summary,
        imageUrl: event.imageUrl,
        formSlug: event.form.slug,
      });
      if (ok) {
        await markInvited(t.id, nowMs());
        sentTo.push(t.displayEmail);
      } else {
        failed++;
      }
    }
    if (sentTo.length > 0 || failed > 0) {
      await emitAudit(session, AUDIT_ACTIONS.eventInvitationsSend, {
        entityId: id,
        context: { Evento: event.name },
        after: { invitees: sentTo, count: sentTo.length, failed },
      });
    }
    // Quedan por mandar si la tanda se cortó en el tope (solo cuando se mandó «a todos»).
    const remaining = parsed.data.ids
      ? 0
      : Math.max(0, (await inviteesToSend(id)).length);
    return apiSuccess({ sent: sentTo.length, failed, remaining });
  } catch (err) {
    return apiCatch("admin/events/[id]/invitees/send POST", err);
  }
}
