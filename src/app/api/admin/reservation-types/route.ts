import { requirePermission } from "@/lib/api-auth";
import { createReservationType } from "@/lib/db/reservationTypes";
import { serializeJson } from "@/lib/json-bigint";
import { reservationTypeInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";

// The read side is public: GET /api/reservation-types.
export async function POST(request: NextRequest) {
  const { error } = await requirePermission("reservation-types:manage");
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
  return NextResponse.json(serializeJson(type), { status: 201 });
}
