import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    // Check if user is admin
    const admin = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }

    const { action } = await request.json()

    if (!action || !['checkout'].includes(action)) {
      return NextResponse.json({ message: "Acción inválida" }, { status: 400 })
    }

    const resolvedParams = await params
    
    // Find check-in by user ID (not check-in ID)
    const checkIn = await prisma.checkIn.findFirst({
      where: {
        user: {
          id: resolvedParams.id
        },
        checkOutTime: null
      }
    })

    if (!checkIn) {
      return NextResponse.json({ message: "Check-in no encontrado o ya cerrado" }, { status: 404 })
    }

    // Update check-out time
    const updatedCheckIn = await prisma.checkIn.update({
      where: { id: checkIn.id },
      data: { 
        checkOutTime: new Date(),
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            name: true,
            lastName: true,
            email: true
          }
        },
        reservation: {
          select: {
            service: true,
            startTime: true,
            endTime: true
          }
        }
      }
    })

    return NextResponse.json(updatedCheckIn)
  } catch (error) {
    console.error("Error updating check-in:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
