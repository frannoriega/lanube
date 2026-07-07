import { auth } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { createReservation } from "@/lib/db/reservations";
import { getCalendarDataBySpace } from "@/lib/db/resourceCalendar";
import { getReservationTypeByCode } from "@/lib/db/reservationTypes";
import { getRegisteredUserById } from "@/lib/db/users";
import { getSpaceById } from "@/lib/db/spaces";
import { serializeJson } from "@/lib/json-bigint";
import { unixMsToDate } from "@/lib/unix-ms";
import { prisma } from "@/lib/prisma";
import { isAfter, startOfDay } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.userId)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await getRegisteredUserById(session.userId);
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 401 },
      );

    const { spaceId } = await params;
    const space = await getSpaceById(spaceId);
    if (!space)
      return NextResponse.json(
        { error: "Espacio no encontrado" },
        { status: 404 },
      );

    const { searchParams } = new URL(request.url);
    const startMs = Number(searchParams.get("startDate"));
    const endMs = Number(searchParams.get("endDate"));
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs))
      return NextResponse.json(
        { error: "Se requieren startDate y endDate en milisegundos UTC" },
        { status: 400 },
      );

    const data = await getCalendarDataBySpace(
      spaceId,
      user.id,
      unixMsToDate(startMs),
      unixMsToDate(endMs),
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.userId)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await getRegisteredUserById(session.userId);
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 401 },
      );

    const { spaceId } = await params;
    const space = await getSpaceById(spaceId);
    if (!space)
      return NextResponse.json(
        { error: "Espacio no encontrado" },
        { status: 404 },
      );

    const body = await request.json();
    const { startTime, endTime, reason, eventType } = body;
    if (!startTime || !endTime || !reason)
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
      );

    const typeCode =
      typeof eventType === "string" && eventType ? eventType : "MEETING";
    if (!(await getReservationTypeByCode(typeCode)))
      return NextResponse.json(
        { error: "Tipo de reserva inválido" },
        { status: 400 },
      );

    const startMs =
      typeof startTime === "number" ? startTime : Number(startTime);
    const endMs = typeof endTime === "number" ? endTime : Number(endTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs))
      return NextResponse.json(
        { error: "startTime y endTime deben ser milisegundos UTC válidos" },
        { status: 400 },
      );

    const startDateTime = unixMsToDate(startMs);
    const endDateTime = unixMsToDate(endMs);

    if (startDateTime >= endDateTime)
      return NextResponse.json(
        { error: "La hora de inicio debe ser anterior a la hora de fin" },
        { status: 400 },
      );

    if (startMs < nowMs())
      return NextResponse.json(
        { error: "No se pueden hacer reservas en el pasado" },
        { status: 400 },
      );

    const serverNow = unixMsToDate(nowMs());
    if (!isAfter(startOfDay(startDateTime), startOfDay(serverNow)))
      return NextResponse.json(
        { error: "Las reservas solo están disponibles a partir de mañana" },
        { status: 400 },
      );

    const dayOfWeek = startDateTime.getUTCDay();
    const startHour = startDateTime.getUTCHours();
    const endHour = endDateTime.getUTCHours();

    if (dayOfWeek === 0 || dayOfWeek === 6)
      return NextResponse.json(
        { error: "Las reservas solo están disponibles de lunes a viernes" },
        { status: 400 },
      );

    if (
      startHour < 12 ||
      endHour > 21 ||
      (endHour === 18 && endDateTime.getMinutes() > 0)
    )
      return NextResponse.json(
        { error: "Las reservas deben estar entre las 9:00 AM y las 6:00 PM" },
        { status: 400 },
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

    return NextResponse.json(serializeJson(reservation), { status: 201 });
  } catch (error) {
    console.error(error);
    const knownError = error as Error;
    return NextResponse.json(
      { error: knownError.message || "Error interno del servidor" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await getRegisteredUserById(session.userId);
    if (!user)
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 401 },
      );

    const body = await request.json();
    const { reservationId } = body || {};
    if (!reservationId)
      return NextResponse.json(
        { error: "reservationId requerido" },
        { status: 400 },
      );

    const existing = await prisma.reservation.findFirst({
      where: { id: reservationId, reservableId: user.id },
    });
    if (!existing)
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 },
      );

    if (
      !(existing.reservableType === "USER" && existing.reservableId === user.id)
    )
      return NextResponse.json(
        { error: "No puedes eliminar esta reserva" },
        { status: 403 },
      );

    await prisma.reservation.delete({ where: { id: reservationId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const knownError = error as Error;
    return NextResponse.json(
      { error: knownError.message || "Error interno del servidor" },
      { status: 500 },
    );
  }
}
