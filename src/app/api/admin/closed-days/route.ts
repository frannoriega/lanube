import { apiCatch } from "@/lib/api/response";
import { requirePermission } from "@/lib/api-auth";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { createClosedDay } from "@/lib/db/closedDays";
import { serializeJson } from "@/lib/json-bigint";
import { closedDayInputSchema } from "@/lib/schemas/closed-days";
import { NextRequest, NextResponse } from "next/server";

// La lectura pública (el calendario muestra los cierres) va por GET /api/closed-days.
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
    return NextResponse.json(serializeJson(closedDay), { status: 201 });
  } catch (err) {
    return apiCatch("admin/closed-days POST", err);
  }
}
