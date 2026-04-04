import { auth } from "@/lib/auth"
import { isAdminUser, listAdminReservationsByType } from "@/lib/db/adminReservations"
import { ResourceType } from "@/generated/prisma/client"
import { serializeJson } from "@/lib/json-bigint"
import { NextRequest, NextResponse } from "next/server"

const MAX_PAGE_SIZE = 100

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email || !session?.userId) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const isAdmin = await isAdminUser(session.userId)
    if (!isAdmin) {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const service = searchParams.get("service")
    const date = searchParams.get("date")
    const pageRaw = searchParams.get("page")
    const pageSizeRaw = searchParams.get("pageSize")
    const status = searchParams.get("status")

    if (!service || !ResourceType[service.toUpperCase() as keyof typeof ResourceType]) {
      return NextResponse.json({ message: "Tipo de recurso inválido" }, { status: 400 })
    }

    const page = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSizeRaw ?? "50", 10) || 50))

    const statusFilter = status && ["PENDING", "APPROVED", "REJECTED"].includes(status)
      ? (status as "PENDING" | "APPROVED" | "REJECTED")
      : undefined

    const { items, total } = await listAdminReservationsByType(
      service.toUpperCase() as ResourceType,
      {
        date: date ?? undefined,
        status: statusFilter,
        page,
        pageSize,
      }
    )

    return NextResponse.json(serializeJson({ items, total }))
  } catch {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
