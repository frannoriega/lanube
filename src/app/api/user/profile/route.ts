import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        dni: true,
        institution: true,
        reasonToJoin: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error fetching user profile:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    const { name, lastName, dni, institution, reasonToJoin } = await request.json()

    // Check if DNI is being changed and if it's already taken by another user
    if (dni && dni !== user.dni) {
      const existingDNI = await prisma.user.findUnique({
        where: { 
          dni,
          NOT: { id: user.id }
        }
      })

      if (existingDNI) {
        return NextResponse.json({ message: "DNI ya registrado por otro usuario" }, { status: 400 })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        lastName,
        dni,
        institution: institution || null,
        reasonToJoin
      },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        dni: true,
        institution: true,
        reasonToJoin: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("Error updating user profile:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
