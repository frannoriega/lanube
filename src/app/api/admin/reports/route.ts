import { requirePermission } from "@/lib/api-auth";
import { getReportForRange } from "@/lib/db/adminReports";
import { NextRequest, NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    // `reports:view` en lugar de "¿es admin en general?". `isAdminByEmail` solo responde
    // `admin:access`, que tienen todos los roles del panel — así que un Comunicador podía leer
    // esto. Mismo defecto que tenían las rutas de check-in (milestone-12, Parte 4).
    const { error } = await requirePermission("reports:view");
    if (error) return error;

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

    const compareFromRaw = searchParams.get("compareFrom");
    const compareToRaw = searchParams.get("compareTo");

    let compareFromMs: number | undefined;
    let compareToMs: number | undefined;

    if (compareFromRaw && compareToRaw) {
      const cfMs = Number(compareFromRaw);
      const ctMs = Number(compareToRaw);
      if (
        Number.isInteger(cfMs) &&
        Number.isInteger(ctMs) &&
        cfMs > 0 &&
        ctMs > 0 &&
        cfMs <= ctMs &&
        ctMs - cfMs <= MAX_RANGE_MS
      ) {
        compareFromMs = cfMs;
        compareToMs = ctMs;
      }
    }

    const report = await getReportForRange(
      fromMs,
      toMs,
      compareFromMs,
      compareToMs,
    );
    return NextResponse.json(report);
  } catch (error) {
    return apiServerError("admin/reports", error);
  }
}
