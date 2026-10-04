import "server-only";
import { nowMs } from "@/lib/clock";
import { getPendingPoliciesForUser } from "@/lib/db/policies";
import { GRANT_LAST_USED_THROTTLE_MS } from "@/lib/oauth/config";
import { touchGrant, verifyAccessToken } from "@/lib/oauth/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Guard del endpoint MCP (milestone 20): el hermano de `requireActiveSession()` para quien
 * llega con `Authorization: Bearer` en lugar de la cookie de NextAuth.
 *
 * Dos niveles de falla, a propósito distintos:
 *
 * 1. **Token** ausente, inválido, vencido, revocado, o de otra audiencia → `unauthorized`. El
 *    route responde `401` con `WWW-Authenticate` (RFC 9728) y el asistente rehace el OAuth.
 * 2. **Estado de la cuenta** — sin perfil completo, suspendida, o con políticas sin aceptar
 *    (milestone 19, la misma `getPendingPoliciesForUser`) → `blocked` con un mensaje legible.
 *    No es un 401: eso haría que el cliente reintente el OAuth en loop, cuando lo que hace
 *    falta es que la persona entre a la web. El MCP lo devuelve como resultado de tool con
 *    error, así el asistente se lo puede decir.
 */

export interface McpUser {
  /** `RegisteredUser.id`: el dueño de las reservas. */
  registeredUserId: string;
  /** `User.id`: la cuenta que autorizó. */
  accountId: string;
  scopes: string[];
  clientName: string;
  grantId: string;
}

export type McpAuthResult =
  | { kind: "unauthorized"; reason: "missing" | "invalid" }
  | { kind: "blocked"; message: string; user: McpUser | null }
  | { kind: "ok"; user: McpUser };

/** Extrae el bearer token del header. Nunca de la query string (los tokens no van en URLs). */
export function bearerTokenOf(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m ? m[1] : null;
}

export async function authenticateMcpRequest(
  request: Request,
  resource: string,
  origin: string,
): Promise<McpAuthResult> {
  const token = bearerTokenOf(request);
  if (!token) return { kind: "unauthorized", reason: "missing" };
  const verified = await verifyAccessToken(token, resource);
  if (!verified) return { kind: "unauthorized", reason: "invalid" };

  // `lastUsedAt` como mucho una vez por minuto: no escribir en cada llamada.
  const last =
    verified.grantLastUsedAt != null ? Number(verified.grantLastUsedAt) : 0;
  if (nowMs() - last > GRANT_LAST_USED_THROTTLE_MS) {
    touchGrant(verified.grantId).catch((err) =>
      logger.warn("mcp: no se pudo actualizar lastUsedAt", {
        err: String(err),
      }),
    );
  }

  const registered = await prisma.registeredUser.findUnique({
    where: { userId: verified.userId },
    select: {
      id: true,
      bans: {
        where: {
          OR: [{ endTime: null }, { endTime: { gt: BigInt(nowMs()) } }],
        },
        orderBy: { endTime: "desc" },
        take: 1,
        select: { reason: true },
      },
    },
  });
  const user: McpUser | null = registered
    ? {
        registeredUserId: registered.id,
        accountId: verified.userId,
        scopes: verified.scopes,
        clientName: verified.clientName,
        grantId: verified.grantId,
      }
    : null;

  if (!registered || !user)
    return {
      kind: "blocked",
      user: null,
      message: `Antes de usar La Nube desde un asistente tenés que completar tu perfil en ${origin}/auth/signup`,
    };
  const ban = registered.bans[0];
  if (ban)
    return {
      kind: "blocked",
      user,
      message: ban.reason
        ? `Tu cuenta de La Nube está suspendida: ${ban.reason}`
        : "Tu cuenta de La Nube está suspendida",
    };
  if ((await getPendingPoliciesForUser(verified.userId)).length > 0)
    return {
      kind: "blocked",
      user,
      message: `Antes de seguir, aceptá las políticas actualizadas de La Nube en ${origin}/policies/accept`,
    };

  return { kind: "ok", user };
}
