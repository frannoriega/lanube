import { auth } from "@/lib/auth"
import { isAdminUser, setReservationStatus } from "@/lib/db/adminReservations"
import { ReservationStatus } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.email || !session?.userId) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    // Check if user is admin
    const isAdmin = await isAdminUser(session.userId)
    if (!isAdmin) {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }

    const { status } = await request.json()

    if (!status || !['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ message: "Estado inválido" }, { status: 400 })
    }

    const resolvedParams = await params
    
    const reservation = await setReservationStatus(resolvedParams.id, status as ReservationStatus)

    return NextResponse.json(reservation)
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
