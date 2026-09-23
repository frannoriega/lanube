import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiSuccess } from "@/lib/api/response";
import { listRoles } from "@/lib/db/roles";

/**
 * The role list the user table's role picker offers. Gated on `users:roles:manage`
 * (assigning a role) rather than `roles:manage` (defining what a role can do) — an admin
 * who can promote users doesn't need to be able to redefine the roles themselves.
 * Returns identity only, never the permission lists.
 */
export async function GET() {
  const { error } = await requirePermission("users:roles:manage");
  if (error) return error;
  try {
    const roles = await listRoles();
    return apiSuccess(
      roles.map(({ id, key, name, isSystem, isSuperadmin }) => ({
        id,
        key,
        name,
        isSystem,
        isSuperadmin,
      })),
    );
  } catch (err) {
    return apiCatch("admin/roles/assignable GET", err);
  }
}
