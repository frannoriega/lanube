import { auth } from "@/lib/auth";
import { isAdminByEmail } from "@/lib/db/adminStats";
import { getReportForRange } from "@/lib/db/adminReports";
import { NextRequest, NextResponse } from "next/server";

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 });
    }
    const isAdmin = await isAdminByEmail(session.user.email);
    if (!isAdmin) {
      return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");

    const fromMs = Number(fromRaw);
    const toMs = Number(toRaw);

    if (
      !fromRaw ||
      !toRaw ||
      !Number.isInteger(fromMs) ||
      !Number.isInteger(toMs) ||
      fromMs <= 0 ||
      toMs <= 0
    ) {
      return NextResponse.json(
        {
          message:
            "Parámetros inválidos: se requieren 'from' y 'to' como timestamps Unix en ms",
        },
        { status: 400 },
      );
    }

    if (fromMs > toMs) {
      return NextResponse.json(
        {
          message:
            "La fecha de inicio debe ser anterior o igual a la fecha de fin",
        },
        { status: 400 },
      );
    }

    if (toMs - fromMs > MAX_RANGE_MS) {
      return NextResponse.json(
        { message: "El rango máximo es de 366 días" },
        { status: 400 },
      );
    }

    const report = await getReportForRange(fromMs, toMs);
    return NextResponse.json(report);
  } catch {
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
