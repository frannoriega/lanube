import { NextRequest, NextResponse } from "next/server"
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

    const incidents = await prisma.incident.findMany({
      include: {
        incidentUsers: {
          include: {
            user: {
              select: {
                name: true,
                lastName: true,
                email: true,
                dni: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(incidents)
  } catch (error) {
    console.error("Error fetching incidents:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const { subject, description } = await request.json()

    if (!subject || !description) {
      return NextResponse.json({ message: "Faltan campos requeridos" }, { status: 400 })
    }

    // Get all users who were present at the time of the incident
    const incidentTime = new Date()
    const incidentStart = new Date(incidentTime.getTime() - 5 * 60 * 1000) // 5 minutes before

    const presentUsers = await prisma.checkIn.findMany({
      where: {
        checkInTime: { lte: incidentTime },
        OR: [
          { checkOutTime: null },
          { checkOutTime: { gte: incidentStart } }
        ]
      },
      include: {
        user: true
      }
    })

    // Create incident
    const incident = await prisma.incident.create({
      data: {
        subject,
        description,
        status: 'OPEN'
      }
    })

    // Create incident-user relationships for all present users
    await Promise.all(
      presentUsers.map(checkIn =>
        prisma.incidentUser.create({
          data: {
            incidentId: incident.id,
            userId: checkIn.user.id,
            checkInId: checkIn.id
          }
        })
      )
    )

    const incidentWithUsers = await prisma.incident.findUnique({
      where: { id: incident.id },
      include: {
        incidentUsers: {
          include: {
            user: {
              select: {
                name: true,
                lastName: true,
                email: true,
                dni: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(incidentWithUsers, { status: 201 })
  } catch (error) {
    console.error("Error creating incident:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
