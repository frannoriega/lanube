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
  const { session, error } = await requirePermission("users:roles:manage");
  if (error) return error;
  try {
    const roles = await listRoles();
    // Los roles superadmin solo se ofrecen a un superadmin: el PATCH los rechaza igual
    // (milestone-12 D27), pero no tiene sentido mostrar en el selector una opción que va a
    // dar 403.
    const assignable = session.isSuperadmin
      ? roles
      : roles.filter((role) => !role.isSuperadmin);
    return apiSuccess(
      assignable.map(({ id, key, name, isSystem, isSuperadmin }) => ({
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
