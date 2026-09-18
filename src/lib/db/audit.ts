import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

const MAX_PAGE_SIZE = 100;

export interface AuditLogListItem {
  id: string;
  actorUserId: string | null;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  requestId: string | null;
  createdAt: number;
}

export interface ListAuditLogsOptions {
  entityType?: string;
  actorUserId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAuditLogsResult {
  items: AuditLogListItem[];
  total: number;
}

export async function listAuditLogs(
  options?: ListAuditLogsOptions,
): Promise<ListAuditLogsResult> {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options?.pageSize ?? 25),
  );

  const where: Prisma.AuditLogWhereInput = {};
  if (options?.entityType) where.entityType = options.entityType;
  if (options?.actorUserId) where.actorUserId = options.actorUserId;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      actorUserId: r.actorUserId,
      actorLabel: r.actorLabel,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      reason: r.reason,
      requestId: r.requestId,
      createdAt: Number(r.createdAt),
    })),
    total,
  };
}

/** Distinct entity types seen so far, for the filter dropdown. */
export async function listAuditEntityTypes(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });
  return rows.map((r) => r.entityType);
}
