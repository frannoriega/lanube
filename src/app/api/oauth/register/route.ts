import { registerDcrClient } from "@/lib/oauth/clients";
import { OAuthError } from "@/lib/oauth/errors";
import { corsPreflight, oauthCatch, oauthJson } from "@/lib/oauth/http";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";

/**
 * POST: Dynamic Client Registration (RFC 7591) — milestone 20. Público por definición (el
 * asistente todavía no tiene credenciales), así que con rate limit por IP: cada llamada crea
 * una fila en `oauth_clients`.
 *
 * El límite es generoso (100/hora) a propósito: los asistentes web registran desde los
 * servidores de su proveedor, así que muchas personas distintas comparten la misma IP.
 *
 * Siempre registra un cliente **público** (`token_endpoint_auth_method: "none"`), aunque el
 * cliente pida otro método: la RFC permite que el servidor ajuste la metadata, y la respuesta
 * le dice al cliente lo que quedó.
 */
export async function POST(request: Request) {
  try {
    const ip = await getClientIp();
    if (!ip) throw new OAuthError("invalid_request", "IP no encontrada");
    const { allowed } = await checkRateLimit(ip, "/api/oauth/register", {
      maxAttempts: 100,
      windowMs: 60 * 60 * 1000,
    });
    if (!allowed)
      return oauthJson(
        {
          error: "invalid_request",
          error_description: "Demasiados registros. Probá más tarde.",
        },
        429,
      );

    const body = await request.json().catch(() => null);
    const client = await registerDcrClient(body);
    return oauthJson(
      {
        client_id: client.clientId,
        client_id_issued_at: Math.floor(Number(client.createdAt) / 1000),
        client_name: client.name,
        redirect_uris: client.redirectUris,
        ...(client.logoUri ? { logo_uri: client.logoUri } : {}),
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      201,
    );
  } catch (err) {
    return oauthCatch("oauth/register POST", err);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
