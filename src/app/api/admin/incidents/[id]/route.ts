import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { IncidentStatus } from "@prisma/client"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }

    const { status } = await request.json()

    if (!status || !['OPEN', 'RESOLVED', 'CLOSED'].includes(status)) {
      return NextResponse.json({ message: "Estado inválido" }, { status: 400 })
    }

    const resolvedParams = await params
    
    const incident = await prisma.incident.findUnique({
      where: { id: resolvedParams.id }
    })

    if (!incident) {
      return NextResponse.json({ message: "Incidente no encontrado" }, { status: 404 })
    }

    const updateData: { status: IncidentStatus; updatedAt: Date; resolvedAt?: Date } = { 
      status: status as IncidentStatus,
      updatedAt: new Date()
    }

    // If resolving, set resolvedAt timestamp
    if (status === 'RESOLVED' && incident.status !== 'RESOLVED') {
      updateData.resolvedAt = new Date()
    }

    const updatedIncident = await prisma.incident.update({
      where: { id: resolvedParams.id },
      data: updateData,
      include: {
        incidentUsers: {
          include: {
            user: {
              select: {
                name: true,
                lastName: true,
                email: true,
                dni: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(updatedIncident)
  } catch (error) {
    console.error("Error updating incident:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
