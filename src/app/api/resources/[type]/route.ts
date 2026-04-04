import { ResourceType } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { now, nowMs } from "@/lib/clock";
import { createReservation } from "@/lib/db/reservations";
import { getCalendarDataByType } from "@/lib/db/resourceCalendar";
import { getRegisteredUserById } from "@/lib/db/users";
import { serializeJson } from "@/lib/json-bigint";
import { unixMsToDate } from "@/lib/unix-ms";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const RESOURCE_TYPE_MAP: Record<string, ResourceType> = {
  coworking: ResourceType.COWORKING,
  lab: ResourceType.LAB,
  auditorium: ResourceType.AUDITORIUM,
  meeting: ResourceType.MEETING,
};

// GET: Fetch calendar data (unavailable slots + user reservations) for a specific resource type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  try {
    const session = await auth();

    if (!session?.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await getRegisteredUserById(session.userId);
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 401 },
      );
    }

    const { type } = await params;
    const resourceType = type.toUpperCase() as ResourceType;
    if (!(resourceType in ResourceType)) {
      return NextResponse.json(
        { error: "Tipo de recurso inválido" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const startMs = Number(startDate);
    const endMs = Number(endDate);
    if (
      !startDate ||
      !endDate ||
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs)
    ) {
      return NextResponse.json(
        { error: "Se requieren startDate y endDate en milisegundos UTC" },
        { status: 400 },
      );
    }

    const data = await getCalendarDataByType(
      resourceType,
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

// POST: Create a new reservation for a specific resource type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  try {
    const session = await auth();

    if (!session?.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await getRegisteredUserById(session.userId);
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 401 },
      );
    }

    const { type } = await params;
    const resourceType = type.toUpperCase() as ResourceType;
    if (!(resourceType in ResourceType)) {
      return NextResponse.json(
        { error: "Tipo de recurso inválido" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { startTime, endTime, reason, eventType } = body;

    // Validate required fields
    if (!startTime || !endTime || !reason) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
      );
    }

    const startMs =
      typeof startTime === "number" ? startTime : Number(startTime);
    const endMs = typeof endTime === "number" ? endTime : Number(endTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return NextResponse.json(
        { error: "startTime y endTime deben ser milisegundos UTC válidos" },
        { status: 400 },
      );
    }
    const startDateTime = unixMsToDate(startMs);
    const endDateTime = unixMsToDate(endMs);

    if (startDateTime >= endDateTime) {
      return NextResponse.json(
        { error: "La hora de inicio debe ser anterior a la hora de fin" },
        { status: 400 },
      );
    }

    if (startMs < nowMs()) {
      return NextResponse.json(
        { error: "No se pueden hacer reservas en el pasado" },
        { status: 400 },
      );
    }

    // Validate business hours (9am - 6pm, weekdays only)
    const dayOfWeek = startDateTime.getUTCDay();
    const startHour = startDateTime.getUTCHours();
    const endHour = endDateTime.getUTCHours();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json(
        { error: "Las reservas solo están disponibles de lunes a viernes" },
        { status: 400 },
      );
    }

    if (
      // Estos horarios estan en UTC. 12 UTC = 9AM UTC-3. 21 UTC = 6PM UTC-3.
      startHour < 12 ||
      endHour > 21 ||
      (endHour === 18 && endDateTime.getMinutes() > 0)
    ) {
      return NextResponse.json(
        { error: "Las reservas deben estar entre las 9:00 AM y las 6:00 PM" },
        { status: 400 },
      );
    }

    const reservation = await createReservation({
      reservableType: "USER",
      reservableId: user.id,
      resourceType,
      eventType: eventType || "MEETING",
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

// DELETE: Delete a reservation (only owner can delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  try {
    const session = await auth();

    if (!session?.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { type } = await params;
    const resourceType = RESOURCE_TYPE_MAP[type];
    if (!resourceType) {
      return NextResponse.json(
        { error: "Tipo de recurso inválido" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { reservationId } = body || {};
    if (!reservationId) {
      return NextResponse.json(
        { error: "reservationId requerido" },
        { status: 400 },
      );
    }

    // Validate ownership
    const user = await prisma.registeredUser.findUnique({
      where: { userId: session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 401 },
      );
    }

    const existing = await prisma.reservation.findFirst({
      where: { id: reservationId, reservableId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 },
      );
    }

    if (
      !(
        existing.reservableType === "USER" && existing.reservableId === user?.id
      )
    ) {
      return NextResponse.json(
        { error: "No puedes eliminar esta reserva" },
        { status: 403 },
      );
    }

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
