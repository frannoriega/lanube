import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const { name, lastName, dni, institution, reasonToJoin, image } = await request.json()

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (existingUser) {
      return NextResponse.json({ message: "Usuario ya existe" }, { status: 400 })
    }

    // Check if DNI is already taken
    const existingDNI = await prisma.user.findUnique({
      where: { dni }
    })

    if (existingDNI) {
      return NextResponse.json({ message: "DNI ya registrado" }, { status: 400 })
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email: session.user.email,
        name,
        lastName,
        dni,
        institution: institution || null,
        reasonToJoin,
        image
      }
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
