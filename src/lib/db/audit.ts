import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { resolveOrderNames } from "@/lib/db/auditOrder";

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
  context: Record<string, string> | null;
  /**
   * Nombres actuales de los ids de un reordenamiento viejo (`after.orderedIds`, sin foto con
   * nombres — ver `src/lib/db/auditOrder.ts`). `null` en cualquier otra entrada.
   */
  names: Record<string, string> | null;
  reason: string | null;
  requestId: string | null;
  createdAt: number;
}

export interface ListAuditLogsOptions {
  entityType?: string;
  actorUserId?: string;
  /** Every entry written by one request: an action together with its cascade. */
  requestId?: string;
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
  if (options?.requestId) where.requestId = options.requestId;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: options?.requestId
        ? { createdAt: "asc" }
        : { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const items: AuditLogListItem[] = rows.map((r) => ({
    id: r.id,
    actorUserId: r.actorUserId,
    actorLabel: r.actorLabel,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    before: r.before,
    after: r.after,
    context: (r.context as Record<string, string> | null) ?? null,
    reason: r.reason,
    requestId: r.requestId,
    createdAt: Number(r.createdAt),
    names: null,
  }));
  await attachLegacyOrderNames(items);
  return { items, total };
}

/**
 * Las entradas de reordenamiento escritas antes de guardar nombres solo tienen
 * `after.orderedIds`: se resuelven a nombres acá, del lado del servidor, para que la UI nunca
 * muestre un cuid2. Una consulta por tipo de entidad presente en la página.
 */
async function attachLegacyOrderNames(items: AuditLogListItem[]) {
  const idsByType = new Map<string, Set<string>>();
  const legacy: AuditLogListItem[] = [];
  for (const item of items) {
    const ids = (item.after as { orderedIds?: unknown } | null)?.orderedIds;
    if (!Array.isArray(ids)) continue;
    legacy.push(item);
    const set = idsByType.get(item.entityType) ?? new Set<string>();
    for (const id of ids) set.add(String(id));
    idsByType.set(item.entityType, set);
  }
  if (legacy.length === 0) return;
  const resolved = new Map(
    await Promise.all(
      [...idsByType].map(
        async ([type, ids]) =>
          [type, await resolveOrderNames(type, [...ids])] as const,
      ),
    ),
  );
  for (const item of legacy) item.names = resolved.get(item.entityType) ?? {};
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
