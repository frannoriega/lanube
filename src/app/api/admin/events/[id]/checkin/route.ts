import { createId } from "@paralleldrive/cuid2";
import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { emitAudit } from "@/lib/audit/emit";
import { PUBLIC_TAGS, revalidatePublic } from "@/lib/cache/public-reads";
import {
  AdmissionRequiredError,
  checkInParticipant,
  getCheckInEvent,
  undoCheckIn,
} from "@/lib/db/event-checkin";
import { checkInSchema, checkInUndoSchema } from "@/lib/schemas/checkin";
import { NextRequest } from "next/server";

/**
 * Check-in de un evento (milestone 30), para la pantalla de la puerta.
 *
 * - `GET`: el evento, sus sesiones y la sesión por defecto.
 * - `POST`: registra el ingreso de una inscripción a una sesión (`admit` para una no aprobada).
 * - `DELETE`: deshace un ingreso.
 *
 * Todo con `events:checkin` (no `events:manage`: un rol de recepción no edita eventos).
 */

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requirePermission("events:checkin");
  if (error) return error;
  try {
    const { id } = await params;
    return apiSuccess(await getCheckInEvent(id));
  } catch (e) {
    return apiCatch("admin/events/[id]/checkin GET", e);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { error, session } = await requirePermission("events:checkin");
  if (error) return error;
  const { id } = await params;
  const parsed = checkInSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return apiError("Datos inválidos", 400, { issues: parsed.error.issues });
  }
  try {
    const {
      session: occurrenceStart,
      participantId,
      memberIds,
      admit,
    } = parsed.data;
    const result = await checkInParticipant(
      id,
      participantId,
      occurrenceStart,
      {
        admit,
        adminId: session.userId,
        memberIds,
      },
    );
    if (!result.alreadyCheckedIn) {
      // Una entrada por persona que ingresó (milestone 34), como los bulk: un mismo pedido.
      const requestId = createId();
      for (const m of result.checkedIn) {
        await emitAudit(session, AUDIT_ACTIONS.participantCheckIn, {
          entityId: id,
          requestId,
          context: {
            Evento: result.eventName,
            Participante: m.displayEmail,
            ...(m.role === "MEMBER"
              ? { Inscripción: result.participant.displayEmail }
              : {}),
          },
          after: {
            participant: m.displayEmail,
            participantId,
            session: result.session.startMs,
            admittedFrom: result.admittedFrom,
          },
        });
      }
      // Admitir a alguien cambia cuántos lugares quedan en las tarjetas públicas.
      if (result.admittedFrom) revalidatePublic(PUBLIC_TAGS.events);
    }
    return apiSuccess({
      participant: result.participant,
      alreadyCheckedIn: result.alreadyCheckedIn,
    });
  } catch (e) {
    if (e instanceof AdmissionRequiredError) {
      return apiError(e.message, 409, { participant: e.participant });
    }
    return apiCatch("admin/events/[id]/checkin POST", e);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requirePermission("events:checkin");
  if (error) return error;
  const { id } = await params;
  const parsed = checkInUndoSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return apiError("Datos inválidos", 400, { issues: parsed.error.issues });
  }
  try {
    const { session: occurrenceStart, participantId, memberId } = parsed.data;
    const undone = await undoCheckIn(
      id,
      participantId,
      occurrenceStart,
      memberId,
    );
    if (!undone) return apiError("No había un ingreso registrado", 404);
    const { participant, member, eventName } = undone;
    await emitAudit(session, AUDIT_ACTIONS.participantCheckInUndo, {
      entityId: id,
      context: { Evento: eventName, Participante: member.displayEmail },
      before: {
        participant: member.displayEmail,
        participantId,
        session: occurrenceStart,
      },
    });
    return apiSuccess({ participant });
  } catch (e) {
    return apiCatch("admin/events/[id]/checkin DELETE", e);
  }
}
