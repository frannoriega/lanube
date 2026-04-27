import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { isAdminUser } from "@/lib/db/adminReservations"
import { reportWindowRequestSchema } from "@/lib/reports/schema/report-window-request"

function firstZodMessage(error: { issues: { message?: string }[] }): string {
  return error.issues[0]?.message ?? "Solicitud inválida"
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.userId) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const admin = await isAdminUser(session.userId)
    if (!admin) {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 })
    }

    const json = await request.json().catch(() => null)
    const parsed = reportWindowRequestSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { message: firstZodMessage(parsed.error) },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        message: "Solicitud de exportación recibida",
        status: "accepted",
        window: {
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        },
        reports: parsed.data.reports,
        jobId: null,
      },
      { status: 202 },
    )
  } catch {
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
