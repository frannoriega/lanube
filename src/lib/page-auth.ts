import "server-only";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "@/lib/rbac";
import { redirect } from "next/navigation";

/**
 * Server-component guard for pages that need a specific permission. Middleware already
 * gates by the JWT role; this re-checks against the DB role (fresh after promotions or
 * demotions) and redirects instead of returning a response.
 */
export async function requirePagePermission(
  permission: Permission,
): Promise<void> {
  const session = await auth();
  if (!session?.userId) redirect("/auth/signin");
  const user = await prisma.registeredUser.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, permission)) {
    redirect("/admin/dashboard");
  }
}
