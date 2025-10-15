import { auth } from "@/lib/auth"
import { getPublicUserByEmail, updateUserProfileByEmail } from "@/lib/db/users"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const user = await getPublicUserByEmail(session.user.email)

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const { name, lastName, dni, institution, reasonToJoin } = await request.json()
    try {
      const updatedUser = await updateUserProfileByEmail(session.user.email, { name, lastName, dni, institution, reasonToJoin })
      return NextResponse.json(updatedUser)
    } catch (e: any) {
      return NextResponse.json({ message: e.message }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
