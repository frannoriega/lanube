import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }

    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)

    // Get current users (checked in but not checked out)
    const currentUsers = await prisma.checkIn.findMany({
      where: {
        checkOutTime: null,
        checkInTime: { gte: startOfDay }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastName: true,
            email: true,
            dni: true
          }
        },
        reservation: {
          select: {
            service: true,
            endTime: true
          }
        }
      },
      orderBy: {
        checkInTime: 'desc'
      }
    })

    return NextResponse.json(currentUsers.map(checkIn => ({
      id: checkIn.user.id,
      name: checkIn.user.name,
      lastName: checkIn.user.lastName,
      email: checkIn.user.email,
      dni: checkIn.user.dni,
      checkInTime: checkIn.checkInTime,
      reservationEndTime: checkIn.reservation?.endTime || '',
      service: checkIn.reservation?.service || 'UNKNOWN',
      reservationId: checkIn.reservationId || ''
    })))
  } catch (error) {
    console.error("Error fetching current users:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
