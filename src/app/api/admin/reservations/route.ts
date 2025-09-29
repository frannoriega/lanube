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

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service')

    const whereClause: { service?: ServiceType } = {}

    if (service && ['COWORKING', 'LAB', 'AUDITORIUM'].includes(service)) {
      whereClause.service = service as ServiceType
    }

    const reservations = await prisma.reservation.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            lastName: true,
            email: true,
            dni: true,
            institution: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(reservations)
  } catch (error) {
    console.error("Error fetching admin reservations:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
