import { auth } from "@/lib/auth"
import { createCheckin, getActiveCheckinByUserId, getUserByEmail } from "@/lib/db/checkins"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const user = await getUserByEmail(session.user.email)

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    const { reservationId } = await request.json()

    try {
      const checkIn = await createCheckin(user.id, reservationId || undefined)
      return NextResponse.json(checkIn, { status: 201 })
    } catch (e: any) {
      return NextResponse.json({ message: e.message }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const user = await getUserByEmail(session.user.email)

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    const activeCheckIn = await getActiveCheckinByUserId(user.id)

    return NextResponse.json(activeCheckIn)
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
