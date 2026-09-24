import { apiCatch } from "@/lib/api/response";
import { requirePermission } from "@/lib/api-auth";
import { createReservationType } from "@/lib/db/reservationTypes";
import { serializeJson } from "@/lib/json-bigint";
import { reservationTypeInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";

// The read side is public: GET /api/reservation-types.
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await requirePermission(
      "reservation-types:manage",
    );
    if (error) return error;

    const body = await request.json().catch(() => null);
    const parsed = reservationTypeInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: parsed.error.issues[0]?.message ?? "Datos inválidos",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const type = await createReservationType(parsed.data);
    await recordAuditFromSession(session, {
      action: AUDIT_ACTIONS.reservationTypeCreate,
      entityType: "ReservationType",
      entityId: type.id,
      after: { code: type.code, name: type.name },
    });
    return NextResponse.json(serializeJson(type), { status: 201 });
  } catch (err) {
    return apiCatch("admin/reservation-types POST", err);
  }
}
