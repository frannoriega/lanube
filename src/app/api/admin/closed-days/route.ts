import { apiCatch } from "@/lib/api/response";
import { requirePermission } from "@/lib/api-auth";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { createClosedDay } from "@/lib/db/closedDays";
import { getReservationsAffectedByClosure } from "@/lib/db/closedDayImpact";
import { serializeJson } from "@/lib/json-bigint";
import { closedDayInputSchema } from "@/lib/schemas/closed-days";
import { NextRequest, NextResponse } from "next/server";

// La lectura pública no pasa por acá: el calendario de reservas recibe los cierres dentro de
// la respuesta de GET /api/resources/[spaceId] (getCalendarDataBySpace).
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requirePermission("closed-days:manage");
    if (error) return error;

    const body = await request.json().catch(() => null);
    const parsed = closedDayInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: parsed.error.issues[0]?.message ?? "Datos inválidos",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const audit = await beginAudit("ClosedDay", null);
    const closedDay = await createClosedDay(parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.closedDayCreate, {
      entityId: closedDay.id,
    });
    // Cuántas reservas vigentes quedaron en conflicto: el formulario lleva al admin a
    // resolverlas en lugar de dejarlas olvidadas (un cierre no cancela nada solo).
    const affectedCount = (await getReservationsAffectedByClosure(closedDay))
      .length;
    return NextResponse.json(
      { ...(serializeJson(closedDay) as object), affectedCount },
      { status: 201 },
    );
  } catch (err) {
    return apiCatch("admin/closed-days POST", err);
  }
}
