import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError } from "@/lib/api/response";
import { parseExportRequest } from "@/lib/reports/export/request";
import {
  ExportNotFoundError,
  generateReportExport,
} from "@/lib/reports/export/server";
import { NextRequest } from "next/server";

/**
 * Exportación de reportes a Excel o CSV (pedido junto al milestone 32; ver
 * `docs/milestones/milestones-32-activity-calendar.md`, «Exportar reportes»). Mismo permiso
 * que ver los reportes (`reports:view`). Qué se exporta lo dice la query (`request.ts`).
 *
 * El archivo se arma en el momento: el volumen (como mucho un año de reservas por día y
 * `MAX_EXPORT_EVENTS` eventos) entra holgado en un pedido, así que no hay cola ni envío por
 * email. Es un GET: no cambia nada, no se audita y no lo frena el modo «solo lectura».
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission("reports:view");
  if (error) return error;

  const parsed = parseExportRequest(request.nextUrl.searchParams);
  if (!parsed.ok) return apiError(parsed.message, 400);

  try {
    const file = await generateReportExport(parsed.value);
    return new Response(file.body as BodyInit, {
      headers: {
        "Content-Type": file.contentType,
        // RFC 6266: `filename` ASCII de respaldo + `filename*` con el nombre real.
        "Content-Disposition": `attachment; filename="${file.filename.replace(/[^\x20-\x7e]|"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof ExportNotFoundError) {
      return apiError("Uno de los eventos elegidos ya no existe", 404);
    }
    return apiCatch("admin/reports/export GET", e);
  }
}
