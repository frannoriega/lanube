import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ReservationStatus } from "@prisma/client"

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
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }

    const { status } = await request.json()

    if (!status || !['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ message: "Estado inválido" }, { status: 400 })
    }

    const resolvedParams = await params
    
    const reservation = await prisma.reservation.findUnique({
      where: { id: resolvedParams.id }
    })

    if (!reservation) {
      return NextResponse.json({ message: "Reserva no encontrada" }, { status: 404 })
    }

    const updatedReservation = await prisma.reservation.update({
      where: { id: resolvedParams.id },
      data: { 
        status: status as ReservationStatus,
        updatedAt: new Date()
      },
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
      }
    })

    return NextResponse.json(updatedReservation)
  } catch (error) {
    console.error("Error updating reservation:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
