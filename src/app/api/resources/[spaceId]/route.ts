import { auth } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { createReservation } from "@/lib/db/reservations";
import { getCalendarDataBySpace } from "@/lib/db/resourceCalendar";
import { getReservationTypeByCode } from "@/lib/db/reservationTypes";
import { getRegisteredUserById } from "@/lib/db/users";
import { getSpaceById } from "@/lib/db/spaces";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { unixMsToDate } from "@/lib/unix-ms";
import { prisma } from "@/lib/prisma";
import { isAfter, startOfDay } from "date-fns";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.userId) return apiError("No autorizado", 401);

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
    const session = await auth();
    if (!session?.userId) return apiError("No autorizado", 401);

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

    if (startMs < nowMs())
      return apiError("No se pueden hacer reservas en el pasado", 400);

    const serverNow = unixMsToDate(nowMs());
    if (!isAfter(startOfDay(startDateTime), startOfDay(serverNow)))
      return apiError(
        "Las reservas solo están disponibles a partir de mañana",
        400,
      );

    const dayOfWeek = startDateTime.getUTCDay();
    const startHour = startDateTime.getUTCHours();
    const endHour = endDateTime.getUTCHours();

    if (dayOfWeek === 0 || dayOfWeek === 6)
      return apiError(
        "Las reservas solo están disponibles de lunes a viernes",
        400,
      );

    if (
      startHour < 12 ||
      endHour > 21 ||
      (endHour === 18 && endDateTime.getMinutes() > 0)
    )
      return apiError(
        "Las reservas deben estar entre las 9:00 AM y las 6:00 PM",
        400,
      );

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
    const session = await auth();
    if (!session?.userId) return apiError("No autorizado", 401);

    const user = await getRegisteredUserById(session.userId);
    if (!user) return apiError("Usuario no encontrado", 401);

    const body = await request.json();
    const { reservationId } = body || {};
    if (!reservationId) return apiError("reservationId requerido", 400);

    const existing = await prisma.reservation.findFirst({
      where: { id: reservationId, reservableId: user.id },
    });
    if (!existing) return apiError("Reserva no encontrada", 404);

    if (
      !(existing.reservableType === "USER" && existing.reservableId === user.id)
    )
      return apiError("No puedes eliminar esta reserva", 403);

    await prisma.reservation.delete({ where: { id: reservationId } });
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiCatch("resources/[spaceId] DELETE", error);
  }
}
