import { requirePermission } from "@/lib/api-auth";
import { getCurrentCheckinsForToday } from "@/lib/db/adminStats";
import { serializeJson } from "@/lib/json-bigint";
import { NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";

export async function GET() {
  try {
    // Antes era `auth()` + `isAdminByEmail()`, que solo pregunta "¿esta persona puede entrar
    // a /admin?" — verdadero para cualquier rol del panel, así que un Comunicador podía leer
    // quién está en el edificio en este momento. El PATCH hermano se migró a un permiso real
    // en el milestone 9 por exactamente este motivo; este GET quedó afuera
    // (milestone-12, Parte 4).
    const { error } = await requirePermission("checkin:manage");
    if (error) return error;

    const rows = await getCurrentCheckinsForToday();
    return NextResponse.json(serializeJson(rows));
  } catch (error) {
    return apiServerError("admin/checkin/current GET", error);
  }
}
