import { requirePermission } from "@/lib/api-auth";
import {
  approveReservationAndRejectConflicts,
  buildReservationAuditContext,
  getReservationNotificationContext,
  previewConflictingPending,
  setReservationStatus,
  type ReservationNotificationContext,
} from "@/lib/db/adminReservations";
import { ReservationStatus } from "@/generated/prisma/client";
import { serializeJson } from "@/lib/json-bigint";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { diffFields } from "@/lib/audit/diff";
import { emitAudit } from "@/lib/audit/emit";
import { notify } from "@/lib/notifications/dispatch";
import type { ReservationDecidedData } from "@/lib/notifications/types";
import { createId } from "@paralleldrive/cuid2";
import { NextRequest, NextResponse } from "next/server";
import { apiCatch } from "@/lib/api/response";

/**
 * Notifies the reservation's owner of an approve/reject decision — only when it's a
 * single-user reservation (TEAM/ORG/EVENT have no one owner; see the milestone doc). Never
 * throws: a notification failure must not fail the decision it describes (same principle
 * as the audit trail).
 */
async function notifyReservationDecision(
  context: ReservationNotificationContext,
  decision: "approved" | "rejected",
) {
  if (context.reservableType !== "USER") return;
  try {
    const data: ReservationDecidedData = {
      reservationId: context.id,
      spaceName: context.spaceName,
      reservationTypeName: context.reservationTypeName,
      startTime: context.startTime,
      endTime: context.endTime,
      reason: decision === "rejected" ? context.deniedReason : undefined,
    };
    await notify({
      type:
        decision === "approved"
          ? "reservation.approved"
          : "reservation.rejected",
      recipient: { registeredUserId: context.reservableId },
      data,
    });
  } catch {
    // Swallow: see doc comment above.
  }
}

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

        const approvedContext = await getReservationNotificationContext(
          resolvedParams.id,
        );

        if (before) {
          const diff = diffFields(before, { ...before, status: "APPROVED" }, [
            "status",
          ]);
          if (diff) {
            await emitAudit(session, AUDIT_ACTIONS.reservationApprove, {
              entityId: resolvedParams.id,
              before: diff.before,
              after: diff.after,
              context: approvedContext
                ? buildReservationAuditContext(approvedContext)
                : null,
              requestId,
            });
          }
        }

        for (const rejectedId of result.autoRejectedIds) {
          const rejectedContext =
            await getReservationNotificationContext(rejectedId);
          await emitAudit(session, AUDIT_ACTIONS.reservationAutoReject, {
            entityId: rejectedId,
            // approve_reservation() only ever touches rows that were PENDING, so the
            // before-state is known without a second query.
            before: { status: "PENDING" },
            after: { status: "REJECTED" },
            context: rejectedContext
              ? buildReservationAuditContext(rejectedContext)
              : null,
            // The actor is the approving admin, not "system": they caused this, even
            // though they never acted on this reservation directly.
            reason: `Rechazada automáticamente al aprobarse la reserva ${resolvedParams.id}`,
            requestId,
          });
          if (rejectedContext) {
            await notifyReservationDecision(rejectedContext, "rejected");
          }
        }

        if (approvedContext) {
          await notifyReservationDecision(approvedContext, "approved");
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
      const context = await getReservationNotificationContext(
        resolvedParams.id,
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
          await emitAudit(
            session,
            status === "REJECTED"
              ? AUDIT_ACTIONS.reservationReject
              : AUDIT_ACTIONS.reservationCancel,
            {
              entityId: resolvedParams.id,
              before: diff.before,
              after: diff.after,
              context: context ? buildReservationAuditContext(context) : null,
              reason: deniedReason ?? null,
            },
          );
        }
      }
      if (status === "REJECTED" && context) {
        await notifyReservationDecision(context, "rejected");
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
