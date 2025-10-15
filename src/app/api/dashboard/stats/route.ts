import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Get upcoming reservations
    const upcomingReservations = await prisma.reservation.count({
      where: {
        userId: user.id,
        startTime: { gte: now },
        status: 'APPROVED'
      }
    })

    // Get reservations for this week
    const reservationsThisWeek = await prisma.reservation.findMany({
      where: {
        userId: user.id,
        startTime: { gte: startOfWeek },
        status: 'APPROVED'
      }
    })

    // Get reservations for this month
    const reservationsThisMonth = await prisma.reservation.findMany({
      where: {
        userId: user.id,
        startTime: { gte: startOfMonth },
        status: 'APPROVED'
      }
    })

    // Calculate total time this week
    const totalTimeThisWeek = reservationsThisWeek.reduce((total, reservation) => {
      const duration = (new Date(reservation.endTime).getTime() - new Date(reservation.startTime).getTime()) / (1000 * 60 * 60)
      return total + duration
    }, 0)

    // Calculate total time this month
    const totalTimeThisMonth = reservationsThisMonth.reduce((total, reservation) => {
      const duration = (new Date(reservation.endTime).getTime() - new Date(reservation.startTime).getTime()) / (1000 * 60 * 60)
      return total + duration
    }, 0)

    // Get recent reservations
    const recentReservations = await prisma.reservation.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    return NextResponse.json({
      upcomingReservations,
      totalTimeThisWeek: Math.round(totalTimeThisWeek * 10) / 10,
      totalTimeThisMonth: Math.round(totalTimeThisMonth * 10) / 10,
      recentReservations: recentReservations.map(reservation => ({
        id: reservation.id,
        service: reservation.service,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        status: reservation.status,
        reason: reservation.reason
      }))
    })
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
