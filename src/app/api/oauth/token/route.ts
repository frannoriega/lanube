import { OAuthError } from "@/lib/oauth/errors";
import { corsPreflight, oauthCatch, oauthJson } from "@/lib/oauth/http";
import {
  exchangeAuthorizationCode,
  refreshAccessToken,
} from "@/lib/oauth/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";

/**
 * POST: endpoint de token OAuth 2.1 (milestone 20). Dos `grant_type`:
 *
 * - `authorization_code` — canjea el código de la pantalla de consentimiento (con PKCE);
 * - `refresh_token` — rota el par (detección de reuso incluida).
 *
 * Cuerpo `application/x-www-form-urlencoded` (lo que exige la RFC); se acepta también JSON
 * porque algunos clientes lo mandan así. Rate limit por IP generoso (300/min): los asistentes
 * web canjean desde los servidores de su proveedor, compartidos entre muchas personas. Toda la lógica vive en `src/lib/oauth/server.ts`.
 */

async function readParams(request: Request): Promise<URLSearchParams> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body ?? {}))
      if (typeof v === "string") params.set(k, v);
    return params;
  }
  return new URLSearchParams(await request.text());
}

function required(params: URLSearchParams, name: string): string {
  const v = params.get(name);
  if (!v) throw new OAuthError("invalid_request", `Falta el parámetro ${name}`);
  return v;
}

export async function POST(request: Request) {
  try {
    const ip = await getClientIp();
    if (!ip) throw new OAuthError("invalid_request", "IP no encontrada");
    const { allowed } = await checkRateLimit(ip, "/api/oauth/token", {
      maxAttempts: 300,
      windowMs: 60_000,
    });
    if (!allowed)
      return oauthJson(
        {
          error: "invalid_request",
          error_description: "Demasiados intentos. Probá en un minuto.",
        },
        429,
      );

    const params = await readParams(request);
    // Los clientes públicos se identifican con `client_id` en el cuerpo. Si alguno manda
    // Basic auth con secreto vacío, se toma el id de ahí.
    let clientId = params.get("client_id");
    const basic = request.headers.get("authorization");
    if (!clientId && basic?.startsWith("Basic ")) {
      const decoded = Buffer.from(basic.slice(6), "base64").toString("utf8");
      clientId = decodeURIComponent(decoded.split(":")[0] ?? "");
    }
    if (!clientId)
      throw new OAuthError("invalid_client", "Falta client_id", 401);

    const grantType = params.get("grant_type");
    if (grantType === "authorization_code") {
      return oauthJson(
        await exchangeAuthorizationCode({
          code: required(params, "code"),
          clientId,
          redirectUri: required(params, "redirect_uri"),
          codeVerifier: required(params, "code_verifier"),
          resource: params.get("resource"),
        }),
      );
    }
    if (grantType === "refresh_token") {
      return oauthJson(
        await refreshAccessToken({
          refreshToken: required(params, "refresh_token"),
          clientId,
          scope: params.get("scope"),
          resource: params.get("resource"),
        }),
      );
    }
    throw new OAuthError(
      "unsupported_grant_type",
      "Solo authorization_code y refresh_token",
    );
  } catch (err) {
    return oauthCatch("oauth/token POST", err);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
