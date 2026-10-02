import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { beginAudit } from "@/lib/audit/emit";
import { createRole, listRolesWithUsage, RoleWriteError } from "@/lib/db/roles";
import { PERMISSIONS } from "@/lib/rbac";
import { NextRequest } from "next/server";
import z from "zod";

const roleInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(60),
  description: z.string().trim().max(240).nullish(),
  // Only catalog permissions are accepted — an unknown string would gate nothing.
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
  // Re-validated against real, non-superadmin roles in `createRole` — this is just shape.
  grantableRoleIds: z.array(z.string()).default([]),
});

/** GET: the role catalog with how many users hold each one. */
export async function GET() {
  const { error } = await requirePermission("roles:manage");
  if (error) return error;
  try {
    return apiSuccess(await listRolesWithUsage());
  } catch (err) {
    return apiCatch("admin/roles GET", err);
  }
}

/** POST: create a new role. */
export async function POST(request: NextRequest) {
  const { session, error } = await requirePermission("roles:manage");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = roleInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Datos inválidos", 400, {
      issues: z.treeifyError(parsed.error),
    });
  }

  try {
    const audit = await beginAudit("Role", null);
    const role = await createRole(parsed.data);
    await audit.commit(session, AUDIT_ACTIONS.roleCreate, {
      entityId: role.id,
    });
    return apiSuccess(role, { status: 201 });
  } catch (err) {
    if (err instanceof RoleWriteError) return apiError(err.message, err.status);
    return apiCatch("admin/roles POST", err);
  }
}
