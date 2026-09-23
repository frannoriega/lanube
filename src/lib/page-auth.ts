import "server-only";
import { auth } from "@/lib/auth";
import { getPermissionSetForUser } from "@/lib/db/roles";
import { hasPermission, type Permission } from "@/lib/rbac";
import { redirect } from "next/navigation";

/**
 * Server-component guard for pages that need a specific permission. Middleware already
 * gates by the JWT permission list; this re-checks against the DB role (fresh after
 * promotions, demotions, or an edit to the role itself) and redirects instead of
 * returning a response.
 */
export async function requirePagePermission(
  permission: Permission,
): Promise<void> {
  const session = await auth();
  if (!session?.userId) redirect("/auth/signin");
  const resolved = await getPermissionSetForUser(session.userId);
  if (!resolved || !hasPermission(resolved.permissions, permission)) {
    redirect("/admin/dashboard");
  }
}
