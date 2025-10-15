import { auth } from "@/lib/auth"
import { getDashboardStatsByEmail } from "@/lib/db/dashboardStats"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const stats = await getDashboardStatsByEmail(session.user.email)
    if (!stats) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }
    return NextResponse.json(stats)
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
