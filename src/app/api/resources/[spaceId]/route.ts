import { requireActiveSession } from "@/lib/api-auth";
import { getCalendarDataBySpace } from "@/lib/db/resourceCalendar";
import { getRegisteredUserById } from "@/lib/db/users";
import { getSpaceById } from "@/lib/db/spaces";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import {
  cancelUserReservation,
  requestUserReservation,
} from "@/lib/reservations/user-actions";
import { unixMsToDate } from "@/lib/unix-ms";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  try {
    const { session, error: authError } = await requireActiveSession();
    if (authError) return authError;

    const user = await getRegisteredUserById(session.userId);
    if (!user) return apiError("Usuario no encontrado", 401);

    const { spaceId } = await params;
    const space = await getSpaceById(spaceId);
    if (!space) return apiError("Espacio no encontrado", 404);

    const { searchParams } = new URL(request.url);
    const startMs = Number(searchParams.get("startDate"));
    const endMs = Number(searchParams.get("endDate"));
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs))
      return apiError(
        "Se requieren startDate y endDate en milisegundos UTC",
        400,
      );

    const data = await getCalendarDataBySpace(
      spaceId,
      user.id,
      unixMsToDate(startMs),
      unixMsToDate(endMs),
    );
    return apiSuccess(data);
  } catch (error) {
    return apiCatch("resources/[spaceId] GET", error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  try {
    const { session, error: authError } = await requireActiveSession();
    if (authError) return authError;

    const user = await getRegisteredUserById(session.userId);
    if (!user) return apiError("Usuario no encontrado", 401);

    const { spaceId } = await params;
    const body = await request.json();
    const { startTime, endTime, reason, eventType } = body;
    if (!startTime || !endTime || !reason)
      return apiError("Faltan campos requeridos", 400);

    // Las reglas (grilla, pasado, anticipación, horario, tipo) viven en la función de
    // dominio, compartida con el conector MCP (milestone 20): acá solo se parsea.
    const reservation = await requestUserReservation(user.id, {
      spaceId,
      startMs: Number(startTime),
      endMs: Number(endTime),
      reason,
      eventType,
    });

    return apiSuccess(reservation, { status: 201 });
  } catch (error) {
    return apiCatch("resources/[spaceId] POST", error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, error: authError } = await requireActiveSession();
    if (authError) return authError;

    const user = await getRegisteredUserById(session.userId);
    if (!user) return apiError("Usuario no encontrado", 401);

    const body = await request.json();
    // occurrenceStartTime (ms), when present, cancels only that one occurrence of a
    // recurring reservation instead of the whole series — see milestone 5.
    const { reservationId, occurrenceStartTime } = body || {};
    if (!reservationId) return apiError("reservationId requerido", 400);

    await cancelUserReservation(user.id, {
      reservationId,
      occurrenceStartMs: occurrenceStartTime,
    });
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiCatch("resources/[spaceId] DELETE", error);
  }
}
