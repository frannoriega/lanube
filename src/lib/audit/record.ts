import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { serializeJson } from "@/lib/json-bigint";
import type { Prisma } from "@/generated/prisma/client";
import { actorLabelFor } from "@/lib/audit/diff";

export interface RecordAuditInput {
  actorUserId: string | null;
  actorLabel: string;
  /** Stable action id, e.g. "reservation.approve", "user.role.update". */
  action: string;
  /** Kind of record acted on, e.g. "Reservation", "RegisteredUser". */
  entityType: string;
  entityId: string;
  /** Only the changed fields, before the write. */
  before?: Record<string, unknown> | null;
  /** Only the changed fields, after the write. */
  after?: Record<string, unknown> | null;
  reason?: string | null;
  /** Correlates entries written by the same request (e.g. cascaded side effects). */
  requestId?: string | null;
}

/**
 * Writes one audit trail entry. Never throws — a broken audit pipe must not
 * break the primary mutation it documents; failures are logged instead so
 * the gap itself stays visible.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorLabel: input.actorLabel,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before: input.before
          ? (serializeJson(input.before) as Prisma.InputJsonValue)
          : undefined,
        after: input.after
          ? (serializeJson(input.after) as Prisma.InputJsonValue)
          : undefined,
        reason: input.reason ?? undefined,
        requestId: input.requestId ?? undefined,
      },
    });
  } catch (err) {
    logger.error("audit/record", err, {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }
}

/**
 * Convenience wrapper: resolves the acting admin's display label from their
 * session and writes the entry. Use this from API routes instead of
 * `recordAudit` directly unless you already have the actor's label at hand.
 */
export async function recordAuditFromSession(
  session: { userId: string },
  input: Omit<RecordAuditInput, "actorUserId" | "actorLabel">,
): Promise<void> {
  try {
    const actor = await prisma.registeredUser.findUnique({
      where: { id: session.userId },
      select: {
        name: true,
        lastName: true,
        user: { select: { email: true, displayEmail: true } },
      },
    });
    const actorLabel = actor
      ? actorLabelFor(actor)
      : `(usuario ${session.userId})`;
    await recordAudit({ ...input, actorUserId: session.userId, actorLabel });
  } catch (err) {
    logger.error("audit/record-from-session", err, {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }
}
