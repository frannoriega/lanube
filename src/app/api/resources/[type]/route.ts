import { auth } from "@/lib/auth";
import { createReservation } from "@/lib/db/reservations";
import { getCalendarDataByType } from "@/lib/db/resourceCalendar";
import { getUserById } from "@/lib/db/users";
import { prisma } from "@/lib/prisma";
import { ResourceType } from "@prisma/client";
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
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await auth();

    if (!session?.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
    }

    const { type } = await params;
    const resourceType = type.toUpperCase() as ResourceType;
    if (!(resourceType in ResourceType)) {
      return NextResponse.json({ error: "Tipo de recurso inválido" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Se requieren fechas de inicio y fin" },
        { status: 400 }
      );
    }

    // Get both unavailable slots and user's own reservations
    const data = await getCalendarDataByType(
      resourceType,
      user.id,
      new Date(startDate),
      new Date(endDate)
    );

    return NextResponse.json(data);
  } catch (error) {
    const { type } = await params;
    console.error(`Error fetching ${type} calendar data:`, error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// POST: Create a new reservation for a specific resource type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await auth();

    if (!session?.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
    }

    const { type } = await params;
    const resourceType = type.toUpperCase() as ResourceType;
    if (!(resourceType in ResourceType)) {
      return NextResponse.json({ error: "Tipo de recurso inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { startTime, endTime, reason, eventType } = body;

    // Validate required fields
    if (!startTime || !endTime || !reason) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);

    // Validate dates
    if (startDateTime >= endDateTime) {
      return NextResponse.json(
        { error: "La hora de inicio debe ser anterior a la hora de fin" },
        { status: 400 }
      );
    }

    if (startDateTime < new Date()) {
      return NextResponse.json(
        { error: "No se pueden hacer reservas en el pasado" },
        { status: 400 }
      );
    }

    // Validate business hours (9am - 6pm, weekdays only)
    const dayOfWeek = startDateTime.getDay();
    const startHour = startDateTime.getHours();
    const endHour = endDateTime.getHours();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json(
        { error: "Las reservas solo están disponibles de lunes a viernes" },
        { status: 400 }
      );
    }

    if (startHour < 9 || endHour > 18 || (endHour === 18 && endDateTime.getMinutes() > 0)) {
      return NextResponse.json(
        { error: "Las reservas deben estar entre las 9:00 AM y las 6:00 PM" },
        { status: 400 }
      );
    }

    const reservation = await createReservation(
      {
        reservableType: "USER",
        reservableId: user.id,
        resourceType,
        eventType: eventType || "MEETING",
        reason,
        startTime: startDateTime,
        endTime: endDateTime,
      }
    )

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    const knownError = error as Error;
    const { type } = await params;
    console.error(`Error creating ${type} reservation:`, error);
    return NextResponse.json(
      { error: knownError.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a reservation (only owner can delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await auth();

    if (!session?.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { type } = await params;
    const resourceType = RESOURCE_TYPE_MAP[type];
    if (!resourceType) {
      return NextResponse.json({ error: "Tipo de recurso inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { reservationId } = body || {};
    if (!reservationId) {
      return NextResponse.json({ error: "reservationId requerido" }, { status: 400 });
    }

    // Validate ownership
    const user = await prisma.registeredUser.findUnique({
      where: { userId: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
    }

    const existing = await prisma.reservation.findUnique({ where: { id: reservationId, reservableId: user?.id } });
    if (!existing) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    if (
      !(existing.reservableType === 'USER' && existing.reservableId === user?.id)
    ) {
      return NextResponse.json({ error: "No puedes eliminar esta reserva" }, { status: 403 });
    }

    await prisma.reservation.delete({ where: { id: reservationId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const knownError = error as Error;
    const { type } = await params;
    console.error(`Error deleting ${type} reservation:`, error);
    return NextResponse.json({ error: knownError.message || "Error interno del servidor" }, { status: 500 });
  }
}

