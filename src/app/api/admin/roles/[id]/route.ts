import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { recordAuditFromSession } from "@/lib/audit/record";
import {
  deleteRole,
  getRoleById,
  RoleWriteError,
  updateRole,
} from "@/lib/db/roles";
import { PERMISSIONS } from "@/lib/rbac";
import { NextRequest } from "next/server";
import z from "zod";

const roleUpdateSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(60),
  description: z.string().trim().max(240).nullish(),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
});

/** PUT: rename a role and/or re-scope its permissions. System roles are rejected. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission("roles:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = roleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Datos inválidos", 400, {
      issues: z.treeifyError(parsed.error),
    });
  }

  const { id } = await params;
  try {
    const before = await getRoleById(id);
    const role = await updateRole(id, parsed.data);
    await recordAuditFromSession(session, {
      action: "role.update",
      entityType: "Role",
      entityId: role.id,
      before: before
        ? {
            name: before.name,
            description: before.description,
            permissions: before.permissions,
          }
        : undefined,
      after: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      },
    });
    return apiSuccess(role);
  } catch (err) {
    if (err instanceof RoleWriteError) return apiError(err.message, err.status);
    return apiCatch("admin/roles/[id] PUT", err);
  }
}

/** DELETE: remove a role. Blocked while any user still holds it, and for system roles. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requirePermission("roles:manage");
  if (error) return error;

  const { id } = await params;
  try {
    const before = await getRoleById(id);
    await deleteRole(id);
    await recordAuditFromSession(session, {
      action: "role.delete",
      entityType: "Role",
      entityId: id,
      before: before
        ? {
            name: before.name,
            description: before.description,
            permissions: before.permissions,
          }
        : undefined,
    });
    return apiSuccess({ ok: true });
  } catch (err) {
    if (err instanceof RoleWriteError) return apiError(err.message, err.status);
    return apiCatch("admin/roles/[id] DELETE", err);
  }
}
