import { auth } from "@/lib/auth"
import { checkoutActiveCheckinByUserId, isAdminByEmail } from "@/lib/db/adminStats"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const isAdmin = await isAdminByEmail(session.user.email)
    if (!isAdmin) {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }

    const { action } = await request.json()

    if (!action || !['checkout'].includes(action)) {
      return NextResponse.json({ message: "Acción inválida" }, { status: 400 })
    }

    const resolvedParams = await params
    
    const updated = await checkoutActiveCheckinByUserId(resolvedParams.id)
    if (!updated) {
      return NextResponse.json({ message: "Check-in no encontrado o ya cerrado" }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
