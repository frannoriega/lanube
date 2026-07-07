import "server-only";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "@/lib/rbac";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";

type GuardResult =
  | { session: Session; error?: never }
  | { session?: never; error: NextResponse };

/**
 * API-route guard: resolves the session and checks the given permission against the
 * user's role read fresh from the DB (the JWT role can be stale after a promotion or
 * demotion mid-session). Usage:
 *
 *   const { session, error } = await requirePermission("events:manage");
 *   if (error) return error;
 */
export async function requirePermission(
  permission: Permission,
): Promise<GuardResult> {
  const session = await auth();
  if (!session?.userId) {
    return {
      error: NextResponse.json({ message: "No autorizado" }, { status: 401 }),
    };
  }
  const user = await prisma.registeredUser.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (!user || !hasPermission(user.role, permission)) {
    return {
      error: NextResponse.json({ message: "Acceso denegado" }, { status: 403 }),
    };
  }
  return { session };
}
