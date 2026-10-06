import "server-only";
import { prisma } from "@/lib/prisma";
import { cache as perRender } from "react";
import {
  NO_PERMISSIONS,
  sanitizePermissions,
  type Permission,
  type PermissionSet,
} from "@/lib/rbac";

/**
 * Role → permission resolution for the server-side enforcement layers.
 *
 * Milestone 9 decided that role edits should take effect *immediately* rather than on a
 * session's next refresh, and named Vercel Global Config as the edge-readable cache. That
 * store can't be provisioned from the repo, so this module is the seam: a tiny provider
 * interface with an in-process, explicitly-invalidated cache as the default. Swapping in
 * Global Config later means implementing `RoleCache` and changing the factory below —
 * no call site moves. See docs/milestones/milestones-9-dynamic-roles.md.
 *
 * Why an in-process cache is enough today: the authoritative checks (`requirePermission`,
 * `requirePagePermission`) run in the same process as the write that invalidated it, and
 * the TTL bounds how long a *different* serverless instance can carry a stale snapshot.
 * Middleware never reads this at all — it reads the permission list off the JWT, which
 * `auth()`'s jwt callback recomputes from the DB on every call.
 */

export type RoleSnapshot = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isSuperadmin: boolean;
  permissions: Permission[];
  /** Ids of the other roles a holder of this role may assign to a user. */
  grantableRoleIds: string[];
};

/** Bounds how long another serverless instance can serve a pre-edit snapshot. */
const CACHE_TTL_MS = 30_000;

type CacheEntry = { at: number; roles: Map<string, RoleSnapshot> };

// Module scope: survives across requests within one warm instance, dies with it.
let cache: CacheEntry | null = null;

/** Call after any write to `roles` so the next read re-reads the DB. */
export function invalidateRoleCache(): void {
  cache = null;
}

function toSnapshot(row: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isSuperadmin: boolean;
  permissions: string[];
  grantableRoleIds: string[];
}): RoleSnapshot {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    isSuperadmin: row.isSuperadmin,
    // Sanitize on read as well as on write: a role row can outlive a permission that a
    // later deploy removed from the catalog.
    permissions: sanitizePermissions(row.permissions),
    grantableRoleIds: row.grantableRoleIds,
  };
}

async function loadRoles(): Promise<Map<string, RoleSnapshot>> {
  const fresh = cache && Date.now() - cache.at < CACHE_TTL_MS;
  if (fresh && cache) return cache.roles;

  const rows = await prisma.role.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isSystem: true,
      isSuperadmin: true,
      permissions: true,
      grantableRoleIds: true,
    },
    orderBy: { name: "asc" },
  });
  const roles = new Map(rows.map((row) => [row.id, toSnapshot(row)]));
  cache = { at: Date.now(), roles };
  return roles;
}

export async function listRoles(): Promise<RoleSnapshot[]> {
  const roles = await loadRoles();
  return Array.from(roles.values());
}

export async function getRoleById(
  roleId: string | null | undefined,
): Promise<RoleSnapshot | null> {
  if (!roleId) return null;
  const roles = await loadRoles();
  return roles.get(roleId) ?? null;
}

export async function getRoleByKey(key: string): Promise<RoleSnapshot | null> {
  const roles = await loadRoles();
  return Array.from(roles.values()).find((role) => role.key === key) ?? null;
}

/** The permission set a role grants. A null role is the base tier: nothing granted. */
export function permissionSetOf(
  role: RoleSnapshot | null | undefined,
): PermissionSet {
  if (!role) return NO_PERMISSIONS;
  return { isSuperadmin: role.isSuperadmin, permissions: role.permissions };
}

/**
 * Resolve a user's permissions straight from the DB (role id), then through the cache.
 * This is the authoritative path used by the API and page guards — deliberately *not*
 * the JWT, which can lag a role change by one request.
 */
/*
 * `cache()` (React) deduplica la lectura dentro de **un mismo render de servidor**: el layout raíz,
 * el de `/admin` o `/user` y la página llaman `auth()` cada uno, y cada `auth()` corre el callback
 * `jwt()`, que repetía estas consultas 2–4 veces por página (milestone 25, P3/DB2). No cambia la
 * frescura entre pedidos —cada pedido lee de nuevo— y fuera de un render (rutas de API) no
 * memoiza nada: ahí se llama una sola vez de todos modos.
 */
export const getPermissionSetForUser = perRender(
  async (
    registeredUserId: string,
  ): Promise<{
    role: RoleSnapshot | null;
    permissions: PermissionSet;
  } | null> => {
    const user = await prisma.registeredUser.findUnique({
      where: { id: registeredUserId },
      select: { roleId: true },
    });
    if (!user) return null;
    const role = await getRoleById(user.roleId);
    return { role, permissions: permissionSetOf(role) };
  },
);

// ---------------------------------------------------------------------------
// Writes (superadmin, `roles:manage`). Every one invalidates the cache.
// ---------------------------------------------------------------------------

/** Thrown for rule violations the API layer turns into a 400/409 with this message. */
export class RoleWriteError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "RoleWriteError";
  }
}

/** Roles a superadmin may list with their current usage, for the /admin/roles table. */
export async function listRolesWithUsage(): Promise<
  Array<RoleSnapshot & { userCount: number }>
> {
  const rows = await prisma.role.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isSystem: true,
      isSuperadmin: true,
      permissions: true,
      grantableRoleIds: true,
      _count: { select: { users: true } },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return rows.map((row) => ({
    ...toSnapshot(row),
    userCount: row._count.users,
  }));
}

/** Display names for a set of role ids, in the given order — for readable audit entries. */
export async function resolveRoleNames(
  ids: readonly string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const roles = await loadRoles();
  return ids.map((id) => roles.get(id)?.name ?? id);
}

/** Derive a stable machine key from a display name, uniquified against existing keys. */
function deriveKey(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "ROL";
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new RoleWriteError("No se pudo generar una clave única para el rol");
}

/**
 * Keeps `grantableRoleIds` honest against rows that actually exist today: drops ids that
 * don't correspond to a role, and — the one rule that can never be relaxed from the UI —
 * drops any `isSuperadmin` role. That tier is only ever granted by hand in the database.
 */
async function sanitizeGrantableRoleIds(
  ids: readonly string[] | undefined,
): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const candidates = new Set(ids);
  const rows = await prisma.role.findMany({
    where: { id: { in: Array.from(candidates) }, isSuperadmin: false },
    select: { id: true },
  });
  const valid = new Set(rows.map((r) => r.id));
  return Array.from(candidates).filter((id) => valid.has(id));
}

export async function createRole(input: {
  name: string;
  description?: string | null;
  permissions: readonly string[];
  grantableRoleIds?: readonly string[];
}): Promise<RoleSnapshot> {
  const name = input.name.trim();
  const existingKeys = new Set(
    (await prisma.role.findMany({ select: { key: true } })).map((r) => r.key),
  );
  try {
    const created = await prisma.role.create({
      data: {
        key: deriveKey(name, existingKeys),
        name,
        description: input.description?.trim() || null,
        // A superadmin can never mint another always-all-powerful tier from the UI.
        isSystem: false,
        isSuperadmin: false,
        permissions: sanitizePermissions(input.permissions),
        grantableRoleIds: await sanitizeGrantableRoleIds(
          input.grantableRoleIds,
        ),
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        isSuperadmin: true,
        permissions: true,
        grantableRoleIds: true,
      },
    });
    invalidateRoleCache();
    return toSnapshot(created);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RoleWriteError("Ya existe un rol con ese nombre", 409);
    }
    throw error;
  }
}

export async function updateRole(
  id: string,
  input: {
    name: string;
    description?: string | null;
    permissions: readonly string[];
    grantableRoleIds?: readonly string[];
  },
): Promise<RoleSnapshot> {
  const current = await prisma.role.findUnique({
    where: { id },
    select: { isSystem: true },
  });
  if (!current) throw new RoleWriteError("El rol no existe", 404);
  if (current.isSystem) {
    throw new RoleWriteError("Los roles del sistema no se pueden editar", 403);
  }
  try {
    const updated = await prisma.role.update({
      where: { id },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        permissions: sanitizePermissions(input.permissions),
        grantableRoleIds: await sanitizeGrantableRoleIds(
          input.grantableRoleIds,
        ),
        updatedAt: BigInt(Date.now()),
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        isSuperadmin: true,
        permissions: true,
        grantableRoleIds: true,
      },
    });
    invalidateRoleCache();
    return toSnapshot(updated);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RoleWriteError("Ya existe un rol con ese nombre", 409);
    }
    throw error;
  }
}

export async function deleteRole(id: string): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { id },
    select: { isSystem: true, _count: { select: { users: true } } },
  });
  if (!role) throw new RoleWriteError("El rol no existe", 404);
  if (role.isSystem) {
    throw new RoleWriteError(
      "Los roles del sistema no se pueden eliminar",
      403,
    );
  }
  if (role._count.users > 0) {
    // Same precedent as ReservationType: an in-use catalog row fails loudly.
    throw new RoleWriteError(
      `No se puede eliminar: ${role._count.users} usuario(s) tienen este rol. Reasignalos primero.`,
      409,
    );
  }
  await prisma.role.delete({ where: { id } });
  invalidateRoleCache();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
