import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";
import {
  addInvitees,
  getInviteeEvent,
  listInvitees,
  removeInvitees,
} from "@/lib/db/eventInvitees";
import {
  MAX_INVITEES_PER_PASTE,
  parseInviteeList,
} from "@/lib/events/invitees";
import { NextRequest } from "next/server";
import { z } from "zod";

/**
 * Invitados de un evento privado (milestone 43), con `events:manage`.
 *
 * - `GET`: el evento y sus invitados (cruzados con las inscripciones).
 * - `POST { emails }`: agrega los emails de un texto pegado; devuelve agregados, ya invitados,
 *   inválidos y repetidos para que la pantalla lo informe.
 * - `DELETE { ids }`: quita invitados (las inscripciones no se tocan).
 *
 * Agregar invitados a un evento **público** está permitido (la lista queda guardada) pero no
 * restringe nada hasta que el evento se vuelva privado: la pantalla lo avisa.
 */
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requirePermission("events:manage");
  if (error) return error;
  const { id } = await params;
  try {
    const event = await getInviteeEvent(id);
    const invitees = await listInvitees(id);
    return apiSuccess({
      event: {
        id: event.id,
        name: event.name,
        isPrivate: event.isPrivate,
        status: event.status,
        cancelled: event.deletedAt != null,
        formSlug: event.form?.slug ?? null,
      },
      invitees,
    });
  } catch (err) {
    return apiCatch("admin/events/[id]/invitees GET", err);
  }
}

const addSchema = z.object({ emails: z.string().max(50_000) });

export async function POST(request: NextRequest, { params }: Params) {
  const { error, session } = await requirePermission("events:manage");
  if (error) return error;
  const { id } = await params;
  const parsed = addSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Datos inválidos", 400);

  const list = parseInviteeList(parsed.data.emails);
  if (list.valid.length === 0) {
    return apiError("No encontramos ningún email válido en el texto", 400, {
      invalid: list.invalid,
    });
  }
  if (list.valid.length > MAX_INVITEES_PER_PASTE) {
    return apiError(
      `Se pueden agregar hasta ${MAX_INVITEES_PER_PASTE} emails por vez`,
      400,
    );
  }
  try {
    const event = await getInviteeEvent(id);
    const { added, existing } = await addInvitees(id, list.valid);
    if (added.length > 0) {
      await emitAudit(session, AUDIT_ACTIONS.eventInviteesAdd, {
        entityId: id,
        context: { Evento: event.name },
        after: {
          invitees: added.map((a) => a.displayEmail),
          count: added.length,
        },
      });
    }
    return apiSuccess({
      added: added.length,
      existing,
      invalid: list.invalid,
      repeated: list.repeated,
    });
  } catch (err) {
    return apiCatch("admin/events/[id]/invitees POST", err);
  }
}

const removeSchema = z.object({ ids: z.array(z.string()).min(1).max(1000) });

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requirePermission("events:manage");
  if (error) return error;
  const { id } = await params;
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Datos inválidos", 400);
  try {
    const event = await getInviteeEvent(id);
    const removed = await removeInvitees(id, parsed.data.ids);
    if (removed.length > 0) {
      await emitAudit(session, AUDIT_ACTIONS.eventInviteesRemove, {
        entityId: id,
        context: { Evento: event.name },
        before: {
          invitees: removed.map((r) => r.displayEmail),
          count: removed.length,
        },
      });
    }
    return apiSuccess({ removed: removed.length });
  } catch (err) {
    return apiCatch("admin/events/[id]/invitees DELETE", err);
  }
}
