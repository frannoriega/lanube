import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import {
  cancelParticipant,
  EDIT_LINK_GONE_MESSAGE,
  getParticipantByToken,
  updateParticipantAnswers,
} from "@/lib/db/participants";
import { participantEditSchema } from "@/lib/schemas/events";
import { NextRequest } from "next/server";

/**
 * Public registration edit/cancel, keyed by one of the participant's edit tokens (milestone 25,
 * S5: se guardan hasheados y vencen cuando termina el evento). Un enlace que no existe o venció
 * responde **410** con `code: "EDIT_LINK_GONE"`: el formulario recarga la página, que muestra la
 * pantalla «este enlace ya no sirve» con el botón para pedir uno nuevo.
 *
 * Milestone 10 / F1.5: none of these three handlers had a `try`/`catch`, so a Prisma
 * failure produced Next's default 500 and never reached `logger.error` — invisible in the
 * production log stream. This is the public endpoint whose failures we would most want to
 * see, which is why it was the priority migration onto the envelope helpers.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const participant = await getParticipantByToken(token);
    if (participant.state !== "ok") {
      return apiError(EDIT_LINK_GONE_MESSAGE, 410, { code: "EDIT_LINK_GONE" });
    }
    return apiSuccess(participant);
  } catch (err) {
    return apiCatch("forms/response/[token] GET", err);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => null);
    const parsed = participantEditSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Datos inválidos", 400);
    }

    const result = await updateParticipantAnswers(token, parsed.data.answers);
    if (!result.ok) {
      if (result.linkGone) {
        return apiError(EDIT_LINK_GONE_MESSAGE, 410, {
          code: "EDIT_LINK_GONE",
        });
      }
      if (result.errors) {
        // Field-level errors ride alongside the message; the public form reads them
        // into react-hook-form via setError.
        return apiError("Revisá los campos", 400, { errors: result.errors });
      }
      return apiError(result.message ?? "No se pudo actualizar", 404);
    }
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("forms/response/[token] PUT", err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const result = await cancelParticipant(token);
    if (!result.ok) {
      if (result.linkGone) {
        return apiError(EDIT_LINK_GONE_MESSAGE, 410, {
          code: "EDIT_LINK_GONE",
        });
      }
      return apiError(result.message ?? "No encontrado", 404);
    }
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("forms/response/[token] DELETE", err);
  }
}
