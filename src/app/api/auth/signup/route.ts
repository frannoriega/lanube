import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const { name, lastName, dni, institution, reasonToJoin } = await request.json()

    // Check if user already exists
    const existingUser = await prisma.registeredUser.findFirst({
      include: { user: true },
      where: { user: { email: session.user.email } }
    })

    if (existingUser) {
      return NextResponse.json({ message: "Usuario ya existe" }, { status: 400 })
    }

    // Create user
    const user = await prisma.registeredUser.create({
      data: {
        user: {
          connect: {
            email: session.user.email
          }
        },
        name,
        lastName,
        dni: dni.toString(),
        institution: institution || null,
        reasonToJoin,
      }
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
