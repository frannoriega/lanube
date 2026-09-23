import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { recordAuditFromSession } from "@/lib/audit/record";
import { createRole, listRolesWithUsage, RoleWriteError } from "@/lib/db/roles";
import { PERMISSIONS } from "@/lib/rbac";
import { NextRequest } from "next/server";
import z from "zod";

const roleInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(60),
  description: z.string().trim().max(240).nullish(),
  // Only catalog permissions are accepted — an unknown string would gate nothing.
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
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
    const role = await createRole(parsed.data);
    await recordAuditFromSession(session, {
      action: "role.create",
      entityType: "Role",
      entityId: role.id,
      after: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      },
    });
    return apiSuccess(role, { status: 201 });
  } catch (err) {
    if (err instanceof RoleWriteError) return apiError(err.message, err.status);
    return apiCatch("admin/roles POST", err);
  }
}
