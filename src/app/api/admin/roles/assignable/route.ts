import { requirePermission } from "@/lib/api-auth";
import { apiCatch, apiSuccess } from "@/lib/api/response";
import { getPermissionSetForUser, listRoles } from "@/lib/db/roles";

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
    // El rol superadmin nunca se ofrece desde el panel, ni siquiera a otro superadmin —
    // ese tier se otorga a mano en la base de datos (ver Role.grantableRoleIds).
    const nonSuperadmin = roles.filter((role) => !role.isSuperadmin);

    // Un superadmin puede asignar cualquier rol no-superadmin. Cualquier otro actor queda
    // limitado a los roles que SU PROPIO rol tiene habilitado otorgar (grantableRoleIds) —
    // así "admins solo pueden otorgar usuario/comunicador" es configurable por rol, no
    // una regla fija en el código.
    let assignable = nonSuperadmin;
    if (!session.isSuperadmin) {
      const resolved = await getPermissionSetForUser(session.userId);
      const grantable = new Set(resolved?.role?.grantableRoleIds ?? []);
      assignable = nonSuperadmin.filter((role) => grantable.has(role.id));
    }

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
