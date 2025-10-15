import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ServiceType } from "@prisma/client"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service')

    const whereClause: { userId: string; service?: ServiceType } = {
      userId: user.id
    }

    if (service && ['COWORKING', 'LAB', 'AUDITORIUM'].includes(service)) {
      whereClause.service = service as ServiceType
    }

    const reservations = await prisma.reservation.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      }
    })

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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

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

    // Check for overlapping reservations
    const overlappingReservation = await prisma.reservation.findFirst({
      where: {
        service,
        status: {
          in: ['PENDING', 'APPROVED']
        },
        OR: [
          {
            startTime: {
              lt: endDateTime
            },
            endTime: {
              gt: startDateTime
            }
          }
        ]
      }
    })

    if (overlappingReservation) {
      return NextResponse.json({ message: "Ya existe una reserva en ese horario" }, { status: 400 })
    }

    // Create reservation
    const reservation = await prisma.reservation.create({
      data: {
        userId: user.id,
        service,
        startTime: startDateTime,
        endTime: endDateTime,
        reason,
        status: 'PENDING'
      }
    })

    return NextResponse.json(reservation, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
