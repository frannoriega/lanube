import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { getEventsReport } from "@/lib/db/eventReports";
import { NextRequest } from "next/server";

/** Mismo tope que el reporte de reservas (`/api/admin/reports`). */
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * El bloque «Eventos» de los reportes para `?from=<ms>&to=<ms>` (milestone 31). Va aparte del
 * reporte de reservas para que la página lo cargue en paralelo y un error en uno no tape al
 * otro. Mismo permiso (`reports:view`) y mismas validaciones del rango.
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission("reports:view");
  if (error) return error;
  const sp = request.nextUrl.searchParams;
  const fromMs = Number(sp.get("from"));
  const toMs = Number(sp.get("to"));
  if (
    !Number.isInteger(fromMs) ||
    !Number.isInteger(toMs) ||
    fromMs <= 0 ||
    toMs <= 0
  ) {
    return apiError(
      "Parámetros inválidos: se requieren 'from' y 'to' como timestamps Unix en ms",
      400,
    );
  }
  if (fromMs > toMs) {
    return apiError(
      "La fecha de inicio debe ser anterior o igual a la fecha de fin",
      400,
    );
  }
  if (toMs - fromMs > MAX_RANGE_MS) {
    return apiError("El rango máximo es de 366 días", 400);
  }
  try {
    return apiSuccess(await getEventsReport(fromMs, toMs));
  } catch (e) {
    return apiCatch("admin/reports/events GET", e);
  }
}
