import { requirePermission } from "@/lib/api-auth";
import {
  approveReservationAndRejectConflicts,
  previewConflictingPending,
  setReservationStatus,
} from "@/lib/db/adminReservations";
import { ReservationStatus } from "@/generated/prisma/client";
import { serializeJson } from "@/lib/json-bigint";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requirePermission("reservations:manage");
    if (error) return error;

    const { status, deniedReason, preview } = await request.json();

    if (!status || !["APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ message: "Estado inválido" }, { status: 400 });
    }

    const resolvedParams = await params;

    if (status === "APPROVED") {
      if (preview) {
        const conflicts =
          await previewConflictingPending(/*resolvedParams.id*/);
        return NextResponse.json({
          approvedId: null,
          autoRejectedIds: conflicts,
        });
      } else {
        const result = await approveReservationAndRejectConflicts(
          resolvedParams.id /*, deniedReason*/,
        );
        return NextResponse.json(result);
      }
    } else {
      const reservation = await setReservationStatus(
        resolvedParams.id,
        status as ReservationStatus,
        deniedReason,
      );
      return NextResponse.json(serializeJson(reservation));
    }
  } catch {
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
