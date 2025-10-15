import { auth } from "@/lib/auth"
import { getCurrentCheckinsForToday, isAdminByEmail } from "@/lib/db/adminStats"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const isAdmin = await isAdminByEmail(session.user.email)
    if (!isAdmin) {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }
    const rows = await getCurrentCheckinsForToday()
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
