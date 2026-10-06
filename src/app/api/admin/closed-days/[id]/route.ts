import { apiCatch } from "@/lib/api/response";
import { requirePermission } from "@/lib/api-auth";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import {
  deleteClosedDay,
  getClosedDay,
  updateClosedDay,
} from "@/lib/db/closedDays";
import { getReservationsAffectedByClosure } from "@/lib/db/closedDayImpact";
import { serializeJson } from "@/lib/json-bigint";
import { closedDayInputSchema } from "@/lib/schemas/closed-days";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    if (!(await getClosedDay(id))) {
      return NextResponse.json(
        { message: "Día cerrado no encontrado" },
        { status: 404 },
      );
    }

    const audit = await beginAudit("ClosedDay", id);
    const closedDay = await updateClosedDay(id, parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.closedDayUpdate);
    const affectedCount =
      closedDay.status === "DISMISSED"
        ? 0
        : (await getReservationsAffectedByClosure(closedDay)).length;
    return NextResponse.json({
      ...(serializeJson(closedDay) as object),
      affectedCount,
    });
  } catch (err) {
    return apiCatch("admin/closed-days PUT", err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error, session } = await requirePermission("closed-days:manage");
    if (error) return error;

    const { id } = await params;
    if (!(await getClosedDay(id))) {
      return NextResponse.json(
        { message: "Día cerrado no encontrado" },
        { status: 404 },
      );
    }

    const audit = await beginAudit("ClosedDay", id);
    await deleteClosedDay(id);
    await audit.commit(session, AUDIT_ACTIONS.closedDayDelete);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiCatch("admin/closed-days DELETE", err);
  }
}
