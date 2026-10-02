import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { deleteRole, RoleWriteError, updateRole } from "@/lib/db/roles";
import { PERMISSIONS } from "@/lib/rbac";
import { NextRequest } from "next/server";
import z from "zod";

const roleUpdateSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(60),
  description: z.string().trim().max(240).nullish(),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
  // Re-validated against real, non-superadmin roles in `updateRole` — this is just shape.
  grantableRoleIds: z.array(z.string()).default([]),
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
    const audit = await beginAudit("Role", id);
    const role = await updateRole(id, parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.roleUpdate);
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
    const audit = await beginAudit("Role", id);
    await deleteRole(id);
    await audit.commit(session, AUDIT_ACTIONS.roleDelete);
    return apiSuccess({ ok: true });
  } catch (err) {
    if (err instanceof RoleWriteError) return apiError(err.message, err.status);
    return apiCatch("admin/roles/[id] DELETE", err);
  }
}
