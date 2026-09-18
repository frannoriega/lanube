import { requirePermission } from "@/lib/api-auth";
import {
  approveReservationAndRejectConflicts,
  previewConflictingPending,
  setReservationStatus,
} from "@/lib/db/adminReservations";
import { ReservationStatus } from "@/generated/prisma/client";
import { serializeJson } from "@/lib/json-bigint";
import { prisma } from "@/lib/prisma";
import { diffFields } from "@/lib/audit/diff";
import { recordAuditFromSession } from "@/lib/audit/record";
import { NextRequest, NextResponse } from "next/server";
import { apiServerError } from "@/lib/api/response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error, session } = await requirePermission("reservations:manage");
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
        const before = await prisma.reservation.findUnique({
          where: { id: resolvedParams.id },
          select: { status: true, deniedReason: true },
        });
        const result = await approveReservationAndRejectConflicts(
          resolvedParams.id /*, deniedReason*/,
        );
        if (before) {
          const diff = diffFields(before, { ...before, status: "APPROVED" }, [
            "status",
          ]);
          if (diff) {
            await recordAuditFromSession(session, {
              action: "reservation.approve",
              entityType: "Reservation",
              entityId: resolvedParams.id,
              before: diff.before,
              after: diff.after,
            });
          }
        }
        return NextResponse.json(result);
      }
    } else {
      const before = await prisma.reservation.findUnique({
        where: { id: resolvedParams.id },
        select: { status: true, deniedReason: true },
      });
      const reservation = await setReservationStatus(
        resolvedParams.id,
        status as ReservationStatus,
        deniedReason,
      );
      if (before) {
        const diff = diffFields(
          before,
          {
            status: reservation.status,
            deniedReason: reservation.deniedReason,
          },
          ["status", "deniedReason"],
        );
        if (diff) {
          await recordAuditFromSession(session, {
            action:
              status === "REJECTED"
                ? "reservation.reject"
                : "reservation.cancel",
            entityType: "Reservation",
            entityId: resolvedParams.id,
            before: diff.before,
            after: diff.after,
            reason: deniedReason ?? null,
          });
        }
      }
      return NextResponse.json(serializeJson(reservation));
    }
  } catch (error) {
    return apiServerError("admin/reservations/[id]", error);
  }
}
