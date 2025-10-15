import { auth } from "@/lib/auth";
import { createReservationForType, getCalendarDataByType, getRegisteredUserIdByEmail } from "@/lib/db/resourceCalendar";
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

    const registeredUserId = await getRegisteredUserIdByEmail(session.user.email)
    if (!registeredUserId) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }
    const data = await getCalendarDataByType("MEETING", registeredUserId, new Date(startDate), new Date(endDate))
    return NextResponse.json(data);
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

    const registeredUserId = await getRegisteredUserIdByEmail(session.user.email)
    if (!registeredUserId) {
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

    const reservation = await createReservationForType(
      "MEETING",
      registeredUserId,
      startDateTime,
      endDateTime,
      reason,
      eventType || "MEETING"
    )

    return NextResponse.json(reservation, { status: 201 });
  } catch (error: any) {
    console.error("Error creating meeting room reservation:", error);
    return NextResponse.json(
      { error: error.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

