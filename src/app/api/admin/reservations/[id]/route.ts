import { auth } from "@/lib/auth"
import { approveReservationAndRejectConflicts, isAdminUser, previewConflictingPending, setReservationStatus } from "@/lib/db/adminReservations"
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

    const { status, deniedReason, preview } = await request.json()

    if (!status || !['APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ message: "Estado inválido" }, { status: 400 })
    }

    const resolvedParams = await params

    if (status === 'APPROVED') {
      if (preview) {
        const conflicts = await previewConflictingPending(resolvedParams.id)
        return NextResponse.json({ approvedId: null, autoRejectedIds: conflicts })
      } else {
        const result = await approveReservationAndRejectConflicts(resolvedParams.id, deniedReason)
        return NextResponse.json(result)
      }
    } else {
      const reservation = await setReservationStatus(resolvedParams.id, status as ReservationStatus, deniedReason)
      return NextResponse.json(reservation)
    }
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
