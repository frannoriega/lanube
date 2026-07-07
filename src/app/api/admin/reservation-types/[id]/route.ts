import { requirePermission } from "@/lib/api-auth";
import {
  deleteReservationType,
  updateReservationType,
} from "@/lib/db/reservationTypes";
import { serializeJson } from "@/lib/json-bigint";
import { reservationTypeInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const type = await updateReservationType(id, parsed.data);
  return NextResponse.json(serializeJson(type));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requirePermission("reservation-types:manage");
  if (error) return error;

  const { id } = await params;
  try {
    // FK RESTRICT on events/reservations blocks deleting a type in use.
    await deleteReservationType(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        message:
          "El tipo está en uso por eventos o reservas y no puede eliminarse",
      },
      { status: 409 },
    );
  }
}
