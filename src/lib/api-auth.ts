import "server-only";
import { auth } from "@/lib/auth";
import { getPermissionSetForUser } from "@/lib/db/roles";
import { hasPermission, type Permission } from "@/lib/rbac";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";

type GuardResult =
  | { session: Session; error?: never }
  | { session?: never; error: NextResponse };

/**
 * Guard de ruta de API para cualquier acción que requiera una cuenta activa, sin exigir un
 * permiso puntual. Exige sesión, perfil completo y **que el usuario no esté suspendido**.
 *
 * Existe porque el baneo era solo un redirect de UI: `src/middleware.ts` solo matchea
 * `/`, `/user/**`, `/admin/**` y `/auth/**` — **`/api/**` no está en el matcher**. Un
 * usuario suspendido con un JWT vivo podía seguir llamando a la API directamente y crear
 * reservas o editar su perfil, porque ninguna ruta volvía a mirar el baneo
 * (milestone-12 D24).
 *
 * El baneo se lee del token, que el callback `jwt()` recalcula contra la base en cada
 * llamada, así que no hay una consulta extra acá.
 */
export async function requireActiveSession(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.userId) {
    return {
      error: NextResponse.json({ message: "No autorizado" }, { status: 401 }),
    };
  }
  if (session.banned) {
    return {
      error: NextResponse.json(
        {
          message: session.bannedReason
            ? `Tu cuenta está suspendida: ${session.bannedReason}`
            : "Tu cuenta está suspendida",
        },
        { status: 403 },
      ),
    };
  }
  return { session };
}

/**
 * Guard de ruta de API: resuelve la sesión y chequea el permiso dado contra el rol del usuario
 * leído fresco de la base (la lista de permisos del JWT puede quedar desactualizada por una
 * request después de un ascenso, una baja, o una edición del propio rol). Uso:
 *
 *   const { session, error } = await requirePermission("events:manage");
 *   if (error) return error;
 */
export async function requirePermission(
  permission: Permission,
): Promise<GuardResult> {
  // Incluye el chequeo de suspensión: un admin suspendido no debe poder seguir operando por
  // API solo porque el middleware no cubre `/api/**` (milestone-12 D24).
  const { session, error } = await requireActiveSession();
  if (error) return { error };
  const resolved = await getPermissionSetForUser(session.userId);
  if (!resolved || !hasPermission(resolved.permissions, permission)) {
    return {
      error: NextResponse.json({ message: "Acceso denegado" }, { status: 403 }),
    };
  }
  return { session };
}
