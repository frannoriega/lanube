import { requireActiveSession } from "@/lib/api-auth";
import { nowMs } from "@/lib/clock";
import {
  createReservation,
  createReservationException,
  deleteReservation,
} from "@/lib/db/reservations";
import { getCalendarDataBySpace } from "@/lib/db/resourceCalendar";
import { getReservationTypeByCode } from "@/lib/db/reservationTypes";
import { getRegisteredUserById } from "@/lib/db/users";
import { getSpaceById } from "@/lib/db/spaces";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { isOnLedgerGrid } from "@/lib/constants/reservations";
import {
  BOOKING_WINDOW_MESSAGES,
  checkBookingWindow,
  hasMinimumNotice,
  MINIMUM_NOTICE_MESSAGE,
} from "@/lib/reservations/booking-window";
import { unixMsToDate } from "@/lib/unix-ms";
import { prisma } from "@/lib/prisma";
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
    const space = await getSpaceById(spaceId);
    if (!space) return apiError("Espacio no encontrado", 404);

    const body = await request.json();
    const { startTime, endTime, reason, eventType } = body;
    if (!startTime || !endTime || !reason)
      return apiError("Faltan campos requeridos", 400);

    const typeCode =
      typeof eventType === "string" && eventType ? eventType : "MEETING";
    if (!(await getReservationTypeByCode(typeCode)))
      return apiError("Tipo de reserva inválido", 400);

    const startMs =
      typeof startTime === "number" ? startTime : Number(startTime);
    const endMs = typeof endTime === "number" ? endTime : Number(endTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs))
      return apiError(
        "startTime y endTime deben ser milisegundos UTC válidos",
        400,
      );

    const startDateTime = unixMsToDate(startMs);
    const endDateTime = unixMsToDate(endMs);

    if (startDateTime >= endDateTime)
      return apiError(
        "La hora de inicio debe ser anterior a la hora de fin",
        400,
      );

    // Mantener toda reserva en la grilla de 15 minutos del ledger. La UI solo ofrece horarios
    // alineados; la API nunca los exigió, y eso es lo que hacía explotable a mano el chequeo
    // de capacidad vacuo (ya corregido) — ver milestone-12 D4.
    if (!isOnLedgerGrid(startMs) || !isOnLedgerGrid(endMs))
      return apiError(
        "Las reservas deben empezar y terminar en intervalos de 15 minutos",
        400,
      );

    if (startMs < nowMs())
      return apiError("No se pueden hacer reservas en el pasado", 400);

    // Anticipación mínima real (24hs de margen), no por día calendario — ver el comentario de
    // MINIMUM_NOTICE_MS en booking-window.ts.
    if (!hasMinimumNotice(startMs, nowMs()))
      return apiError(MINIMUM_NOTICE_MESSAGE, 400);

    // Reglas de día de semana + horario de apertura, comparadas en la zona horaria del
    // propio predio. La versión anterior, escrita acá mismo, usaba getUTCDay()/getUTCHours()
    // contra un predio en UTC−3 y erraba en los dos extremos de la ventana — ver el comentario
    // de checkBookingWindow (milestone-12 D14).
    const violation = checkBookingWindow(startMs, endMs);
    if (violation) return apiError(BOOKING_WINDOW_MESSAGES[violation], 400);

    const reservation = await createReservation({
      reservableType: "USER",
      reservableId: user.id,
      spaceId,
      eventType: typeCode,
      reason,
      startTime: startDateTime,
      endTime: endDateTime,
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

    const existing = await prisma.reservation.findFirst({
      where: { id: reservationId, reservableId: user.id },
    });
    if (!existing) return apiError("Reserva no encontrada", 404);

    if (
      !(existing.reservableType === "USER" && existing.reservableId === user.id)
    )
      return apiError("No puedes eliminar esta reserva", 403);

    if (occurrenceStartTime != null) {
      if (!existing.isRecurring)
        return apiError(
          "Esta reserva no es recurrente; cancelá la reserva completa",
          400,
        );
      const ms = Number(occurrenceStartTime);
      if (!Number.isFinite(ms))
        return apiError("occurrenceStartTime inválido", 400);
      await createReservationException(reservationId, unixMsToDate(ms), {
        isCancelled: true,
      });
      return apiSuccess({ ok: true });
    }

    // Vía la función de dominio, no prisma.delete: esa se niega a borrar una reserva que ya
    // empezó (lo que además desvincularía sus check-ins, porque check_ins.reservation_id es
    // ON DELETE SET NULL). Las filas del ledger ahora cascadean — antes de la FK que agregó
    // 20260924100000 quedaban huérfanas y seguían ocupando el lugar.
    await deleteReservation(reservationId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiCatch("resources/[spaceId] DELETE", error);
  }
}
