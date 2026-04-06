import { auth } from "@/lib/auth"
import { isAdminUser, listAdminReservationsByRange } from "@/lib/db/adminReservations"
import { serializeJson } from "@/lib/json-bigint"
import { NextRequest, NextResponse } from "next/server"

function parseTimestamp(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

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
    const startDate = parseTimestamp(searchParams.get("startDate"))
    const endDate = parseTimestamp(searchParams.get("endDate"))
    const pageRaw = searchParams.get("page")
    const pageSizeRaw = searchParams.get("pageSize")

    if (startDate == null || endDate == null) {
      return NextResponse.json(
        { message: "Se requiere startDate y endDate (Unix ms)" },
        { status: 400 },
      )
    }

    const page = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeRaw ?? "50", 10) || 50))

    const { items, total } = await listAdminReservationsByRange(startDate, endDate, { page, pageSize })

    return NextResponse.json(serializeJson({ items, total }))
  } catch {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
