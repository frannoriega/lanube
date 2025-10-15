import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    const { reservationId } = await request.json()

    // Check if user has an active check-in
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: user.id,
        checkOutTime: null
      }
    })

    if (activeCheckIn) {
      return NextResponse.json({ message: "Ya tienes un check-in activo" }, { status: 400 })
    }

    // If reservationId is provided, validate it
    let reservation = null
    if (reservationId) {
      reservation = await prisma.reservation.findFirst({
        where: {
          id: reservationId,
          userId: user.id,
          status: 'APPROVED'
        }
      })

      if (!reservation) {
        return NextResponse.json({ message: "Reserva no encontrada o no aprobada" }, { status: 400 })
      }

      // Check if reservation time is valid (within 30 minutes of start time)
      const now = new Date()
      const startTime = new Date(reservation.startTime)
      const timeDiff = Math.abs(now.getTime() - startTime.getTime()) / (1000 * 60) // minutes

      if (timeDiff > 30) {
        return NextResponse.json({ message: "No puedes hacer check-in fuera del horario de tu reserva" }, { status: 400 })
      }
    }

    // Create check-in
    const checkIn = await prisma.checkIn.create({
      data: {
        userId: user.id,
        reservationId: reservationId || null,
        checkInTime: new Date()
      },
      include: {
        reservation: {
          select: {
            service: true,
            startTime: true,
            endTime: true
          }
        }
      }
    })

    return NextResponse.json(checkIn, { status: 201 })
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function GET() {
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

    // Get current active check-in
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        userId: user.id,
        checkOutTime: null
      },
      include: {
        reservation: {
          select: {
            service: true,
            startTime: true,
            endTime: true
          }
        }
      }
    })

    return NextResponse.json(activeCheckIn)
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
