import { auth } from "@/lib/auth"
import { getUserById, updateUserProfileByEmail } from "@/lib/db/users"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.userId) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const user = await getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 401 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error(error)
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
    } catch (error) {
      const knownError = error as Error;
      return NextResponse.json({ message: knownError.message }, { status: 400 })
    }
  } catch (error) {
    console.error(error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
