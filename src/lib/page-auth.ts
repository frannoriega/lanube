import "server-only";
import { auth } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/rbac";
import { redirect } from "next/navigation";

/**
 * Server-component guard for pages that need a specific permission. Middleware already
 * gates by the JWT permission list read from the cookie, which can lag; this re-checks
 * against the session `auth()` resolves, whose permissions the `jwt()` callback just
 * recomputed from the DB in this same request (so a promotion, demotion or role edit
 * applies here at once) — no second role read needed (milestone 25, DB1).
 */
export async function requirePagePermission(
  permission: Permission,
): Promise<void> {
  const session = await auth();
  if (!session?.userId) redirect("/auth/signin");
  if (!hasPermission(session, permission)) {
    redirect("/admin/dashboard");
  }
}
