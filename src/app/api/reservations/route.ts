import { auth } from "@/lib/auth"
import { createUserReservation, getUserByEmail, listUserReservations } from "@/lib/db/userReservations"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const user = await getUserByEmail(session.user.email)

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service')

    const whereClause: { userId: string; service?: string } = {
      userId: user.id
    }

    if (service && ['COWORKING', 'LAB', 'AUDITORIUM'].includes(service)) {
      whereClause.service = service as string
    }

    const reservations = await listUserReservations(whereClause.userId, whereClause.service)

    return NextResponse.json(reservations)
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const user = await getUserByEmail(session.user.email)

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    const { service, startTime, endTime, reason } = await request.json()

    // Validate required fields
    if (!service || !startTime || !endTime || !reason) {
      return NextResponse.json({ message: "Faltan campos requeridos" }, { status: 400 })
    }

    const startDateTime = new Date(startTime)
    const endDateTime = new Date(endTime)

    // Validate dates
    if (startDateTime >= endDateTime) {
      return NextResponse.json({ message: "La hora de inicio debe ser anterior a la hora de fin" }, { status: 400 })
    }

    if (startDateTime < new Date()) {
      return NextResponse.json({ message: "No se pueden hacer reservas en el pasado" }, { status: 400 })
    }

    const reservation = await createUserReservation(user.id, service as string, startDateTime, endDateTime, reason)

    return NextResponse.json(reservation, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
