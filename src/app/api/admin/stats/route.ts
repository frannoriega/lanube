import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    // TODO: Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }

    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Get user counts
    const todayUsers = await prisma.checkIn.count({
      where: {
        checkInTime: { gte: startOfDay }
      }
    })

    const weekUsers = await prisma.checkIn.count({
      where: {
        checkInTime: { gte: startOfWeek }
      }
    })

    const monthUsers = await prisma.checkIn.count({
      where: {
        checkInTime: { gte: startOfMonth }
      }
    })

    // Get reservation counts
    const pendingReservations = await prisma.reservation.count({
      where: { status: 'PENDING' }
    })

    const approvedReservations = await prisma.reservation.count({
      where: { 
        status: 'APPROVED',
        startTime: { gte: now }
      }
    })

    const rejectedReservations = await prisma.reservation.count({
      where: { status: 'REJECTED' }
    })

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
            lastName: true
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

    // Get recent reservations
    const recentReservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            name: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    return NextResponse.json({
      todayUsers,
      weekUsers,
      monthUsers,
      pendingReservations,
      approvedReservations,
      rejectedReservations,
      currentUsers: currentUsers.map(checkIn => ({
        id: checkIn.user.id,
        name: checkIn.user.name,
        lastName: checkIn.user.lastName,
        checkInTime: checkIn.checkInTime,
        reservationEndTime: checkIn.reservation?.endTime || '',
        service: checkIn.reservation?.service || 'UNKNOWN'
      })),
      recentReservations: recentReservations.map(reservation => ({
        id: reservation.id,
        user: {
          name: reservation.user.name,
          lastName: reservation.user.lastName
        },
        service: reservation.service,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        status: reservation.status,
        reason: reservation.reason
      }))
    })
  } catch (error) {
    console.error("Error fetching admin stats:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
