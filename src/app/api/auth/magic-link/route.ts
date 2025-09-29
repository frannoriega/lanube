import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json()

    if (!email || !token) {
      return NextResponse.json(
        { message: "Email y token son requeridos" },
        { status: 400 }
      )
    }

    // Decode and validate token
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const [tokenEmail, timestamp] = decoded.split(':')
    
    if (tokenEmail !== email) {
      return NextResponse.json(
        { message: "Token inválido" },
        { status: 400 }
      )
    }

    // Check if token is not expired (24 hours)
    const tokenTime = parseInt(timestamp)
    const now = Date.now()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    
    if (now - tokenTime > maxAge) {
      return NextResponse.json(
        { message: "El enlace ha expirado" },
        { status: 400 }
      )
    }

    // Check if user exists, if not create them
    let user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          name: email.split('@')[0], // Use email prefix as name
          lastName: '', // Will be filled in signup
          dni: '', // Will be filled in signup
          institution: '', // Will be filled in signup
          reasonToJoin: 'Acceso por email', // Default reason
          role: 'USER',
          image: null
        }
      })
    }

    // In a real implementation, you would create a session here
    // For now, we'll just return success
    return NextResponse.json(
      { 
        message: "Inicio de sesión exitoso",
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Magic link validation error:', error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
