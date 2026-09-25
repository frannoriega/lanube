import { requirePermission } from "@/lib/api-auth";
import { getAdminAggregateStats } from "@/lib/db/adminStats";
import { serializeJson } from "@/lib/json-bigint";
import { NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";

export async function GET() {
  try {
    // Los contadores agregados del panel — totales de reservas/usuarios/ingresos. Se exige
    // `reports:view` por el mismo motivo que en /api/admin/reports: `isAdminByEmail` solo
    // significa `admin:access` (milestone-12, Parte 4).
    const { error } = await requirePermission("reports:view");
    if (error) return error;

    const result = await getAdminAggregateStats();
    return NextResponse.json(serializeJson(result));
  } catch (error) {
    return apiServerError("admin/stats GET", error);
  }
}
