import { auth } from "@/lib/auth"
import { isAdminUser, listAdminReservationsByType } from "@/lib/db/adminReservations"
import { ResourceType } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    console.log(session)
    if (!session?.user?.email || !session?.userId) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    // Check if user is admin
    const isAdmin = await isAdminUser(session.userId)
    if (!isAdmin) {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const service = searchParams.get('service')

    if (!service || !ResourceType[service.toUpperCase() as keyof typeof ResourceType]) {
      return NextResponse.json({ message: "Tipo de recurso inválido" }, { status: 400 })
    }

    const reservations = await listAdminReservationsByType(service.toUpperCase() as ResourceType)

    return NextResponse.json(reservations)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
