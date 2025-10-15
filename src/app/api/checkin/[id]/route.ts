import { auth } from "@/lib/auth"
import { checkoutUserCheckin, getUserByEmail } from "@/lib/db/checkins"
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

    const user = await getUserByEmail(session.user.email)

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    const { action } = await request.json()

    if (!action || !['checkout'].includes(action)) {
      return NextResponse.json({ message: "Acción inválida" }, { status: 400 })
    }

    const resolvedParams = await params
    
    const updated = await checkoutUserCheckin(user.id, resolvedParams.id)
    if (!updated) {
      return NextResponse.json({ message: "Check-in no encontrado o ya cerrado" }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
