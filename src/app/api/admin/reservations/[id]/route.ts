import { requirePermission } from "@/lib/api-auth";
import {
  approveReservationAndRejectConflicts,
  previewConflictingPending,
  setReservationStatus,
} from "@/lib/db/adminReservations";
import { ReservationStatus } from "@/generated/prisma/client";
import { serializeJson } from "@/lib/json-bigint";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { diffFields } from "@/lib/audit/diff";
import { recordAuditFromSession } from "@/lib/audit/record";
import { createId } from "@paralleldrive/cuid2";
import { NextRequest, NextResponse } from "next/server";
import { apiCatch } from "@/lib/api/response";

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
        const conflicts = await previewConflictingPending(resolvedParams.id);
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

        // One approval can cascade into rejecting other people's reservations. Every
        // entry from this request shares a requestId so the view can group the cascade
        // under the approval that caused it (the milestone's cascade-attribution
        // question, resolved as "N atomic entries linked by a correlation id").
        const requestId = createId();

        if (before) {
          const diff = diffFields(before, { ...before, status: "APPROVED" }, [
            "status",
          ]);
          if (diff) {
            await recordAuditFromSession(session, {
              action: AUDIT_ACTIONS.reservationApprove,
              entityType: "Reservation",
              entityId: resolvedParams.id,
              before: diff.before,
              after: diff.after,
              requestId,
            });
          }
        }

        for (const rejectedId of result.autoRejectedIds) {
          await recordAuditFromSession(session, {
            action: AUDIT_ACTIONS.reservationAutoReject,
            entityType: "Reservation",
            entityId: rejectedId,
            // approve_reservation() only ever touches rows that were PENDING, so the
            // before-state is known without a second query.
            before: { status: "PENDING" },
            after: { status: "REJECTED" },
            // The actor is the approving admin, not "system": they caused this, even
            // though they never acted on this reservation directly.
            reason: `Rechazada automáticamente al aprobarse la reserva ${resolvedParams.id}`,
            requestId,
          });
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
                ? AUDIT_ACTIONS.reservationReject
                : AUDIT_ACTIONS.reservationCancel,
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
    // apiCatch y no apiServerError: approve_reservation() ahora levanta un DomainError con
    // mensaje mostrable cuando la reserva ya no entra (milestone-12 D3), y el admin necesita
    // leer el motivo en lugar de "Error interno del servidor".
    return apiCatch("admin/reservations/[id]", error);
  }
}
