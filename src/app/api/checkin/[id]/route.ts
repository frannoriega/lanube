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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    const { action } = await request.json()

    if (!action || !['checkout'].includes(action)) {
      return NextResponse.json({ message: "Acción inválida" }, { status: 400 })
    }

    const resolvedParams = await params
    
    const checkIn = await prisma.checkIn.findFirst({
      where: {
        id: resolvedParams.id,
        userId: user.id,
        checkOutTime: null
      }
    })

    if (!checkIn) {
      return NextResponse.json({ message: "Check-in no encontrado o ya cerrado" }, { status: 404 })
    }

    // Update check-out time
    const updatedCheckIn = await prisma.checkIn.update({
      where: { id: resolvedParams.id },
      data: { 
        checkOutTime: new Date(),
        updatedAt: new Date()
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

    return NextResponse.json(updatedCheckIn)
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
