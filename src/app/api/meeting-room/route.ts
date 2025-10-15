import { auth } from "@/lib/auth";
import { createReservation, getExpandedReservationsForCalendar } from "@/lib/db/reservations";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET: Fetch expanded reservations for meeting room
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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

    // Get user's registered user ID for filtering
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { registeredUser: true },
    });

    if (!user?.registeredUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Get expanded reservations for all meeting room resources
    // PostgreSQL function handles finding all fungible resources and their resources
    const occurrences = await getExpandedReservationsForCalendar(
      "MEETING",
      user.registeredUser.id,
      new Date(startDate),
      new Date(endDate)
    );

    // Get fungible resource info for capacity/metadata
    const meetingRoomResource = await prisma.fungibleResource.findFirst({
      where: { type: "MEETING" },
      include: { resources: true },
    });

    return NextResponse.json({
      occurrences,
      capacity: meetingRoomResource?.capacity || 1,
      resources: meetingRoomResource?.resources || [],
    });
  } catch (error) {
    console.error("Error fetching meeting room reservations:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST: Create a new meeting room reservation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { registeredUser: true },
    });

    if (!user?.registeredUser) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { startTime, endTime, reason, eventType } = body;

    // Validate required fields
    if (!startTime || !endTime || !reason) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
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

    // Get an available meeting room resource
    const meetingRoomResource = await prisma.fungibleResource.findFirst({
      where: { type: "MEETING" },
      include: { resources: true },
    });

    if (!meetingRoomResource || meetingRoomResource.resources.length === 0) {
      return NextResponse.json(
        { error: "No hay salas de reuniones disponibles" },
        { status: 404 }
      );
    }

    // Use the first available resource (in a real app, you'd check availability)
    const resourceId = meetingRoomResource.resources[0].id;

    // Create the reservation
    const reservation = await createReservation({
      reservableType: "USER",
      reservableId: user.registeredUser.id,
      resourceId,
      eventType: eventType || "MEETING",
      reason,
      startTime: startDateTime,
      endTime: endDateTime,
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error: any) {
    console.error("Error creating meeting room reservation:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

