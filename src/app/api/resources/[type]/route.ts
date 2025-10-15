import { auth } from "@/lib/auth";
import { createReservation, getExpandedReservationsForCalendar } from "@/lib/db/reservations";
import { prisma } from "@/lib/prisma";
import { ResourceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const RESOURCE_TYPE_MAP: Record<string, ResourceType> = {
  coworking: "COWORKING",
  lab: "LAB",
  auditorium: "AUDITORIUM",
  "meeting-room": "MEETING",
};

// GET: Fetch expanded reservations for a specific resource type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { type } = await params;
    const resourceType = RESOURCE_TYPE_MAP[type];
    if (!resourceType) {
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

    // Get expanded reservations for all resources of this type
    // PostgreSQL function handles finding fungible resources and their individual resources
    console.log('Fetching reservations for:', {
      resourceType,
      userId: user.registeredUser.id,
      startDate,
      endDate
    });

    const occurrences = await getExpandedReservationsForCalendar(
      resourceType,
      user.registeredUser.id,
      new Date(startDate),
      new Date(endDate)
    );

    console.log(`Found ${occurrences.length} occurrences`);

    // Get fungible resource info for capacity/metadata
    const fungibleResource = await prisma.fungibleResource.findFirst({
      where: { type: resourceType },
      include: { resources: true },
    });

    console.log('Fungible resource:', fungibleResource?.name, 'Resources:', fungibleResource?.resources.length);

    return NextResponse.json({
      occurrences,
      capacity: fungibleResource?.capacity || 1,
      resources: fungibleResource?.resources || [],
    });
  } catch (error) {
    const { type } = await params;
    console.error(`Error fetching ${type} reservations:`, error);
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

    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { type } = await params;
    const resourceType = RESOURCE_TYPE_MAP[type];
    if (!resourceType) {
      return NextResponse.json({ error: "Tipo de recurso inválido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { registeredUser: true },
    });

    if (!user?.registeredUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
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

    // Get an available resource of this type
    const fungibleResource = await prisma.fungibleResource.findFirst({
      where: { type: resourceType },
      include: { resources: true },
    });

    if (!fungibleResource || fungibleResource.resources.length === 0) {
      return NextResponse.json(
        { error: `No hay recursos de tipo ${type} disponibles` },
        { status: 404 }
      );
    }

    // Use the first available resource (in a real app, you'd check availability)
    const resourceId = fungibleResource.resources[0].id;

    console.log('Creating reservation:', {
      resourceType,
      resourceId,
      userId: user.registeredUser.id,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      reason
    });

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

    console.log('Created reservation:', reservation.id);

    return NextResponse.json(reservation, { status: 201 });
  } catch (error: any) {
    const { type } = await params;
    console.error(`Error creating ${type} reservation:`, error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

