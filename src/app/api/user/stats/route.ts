import { requireActiveSession } from "@/lib/api-auth";
import { getDashboardStatsByUserId } from "@/lib/db/dashboardStats";
import { serializeJson } from "@/lib/json-bigint";
import { NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";

export async function GET() {
  try {
    // requireActiveSession y no auth() a pelo: también corta a suspendidos y a cuentas con
    // políticas sin aceptar (milestone-12 D24, milestone 19).
    const { session, error } = await requireActiveSession();
    if (error) return error;

    const stats = await getDashboardStatsByUserId(session.userId);

    return NextResponse.json(serializeJson(stats));
  } catch (error) {
    return apiServerError("user/stats GET", error);
  }
}
