import { requirePermission } from "@/lib/api-auth";
import { diffFields } from "@/lib/audit/diff";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { recordAuditFromSession } from "@/lib/audit/record";
import {
  deleteReservationType,
  updateReservationType,
} from "@/lib/db/reservationTypes";
import { serializeJson } from "@/lib/json-bigint";
import { prisma } from "@/lib/prisma";
import { reservationTypeInputSchema } from "@/lib/schemas/config";
import { NextRequest, NextResponse } from "next/server";

const AUDITED_RESERVATION_TYPE_FIELDS = ["name", "displayOrder"] as const;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission(
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

  const { id } = await params;
  const before = await prisma.reservationType.findUnique({
    where: { id },
    select: { name: true, displayOrder: true },
  });
  const type = await updateReservationType(id, parsed.data);
  if (before) {
    const diff = diffFields(before, type, [...AUDITED_RESERVATION_TYPE_FIELDS]);
    if (diff) {
      await recordAuditFromSession(session, {
        action: AUDIT_ACTIONS.reservationTypeUpdate,
        entityType: "ReservationType",
        entityId: id,
        context: { "Tipo de reserva": type.name },
        ...diff,
      });
    }
  }
  return NextResponse.json(serializeJson(type));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission(
    "reservation-types:manage",
  );
  if (error) return error;

  const { id } = await params;
  try {
    const before = await prisma.reservationType.findUnique({
      where: { id },
      select: { name: true },
    });
    // FK RESTRICT on events/reservations blocks deleting a type in use.
    await deleteReservationType(id);
    if (before) {
      await recordAuditFromSession(session, {
        action: AUDIT_ACTIONS.reservationTypeDelete,
        entityType: "ReservationType",
        entityId: id,
        before: { name: before.name },
      });
    }
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
