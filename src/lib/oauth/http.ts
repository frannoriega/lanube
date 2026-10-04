import "server-only";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  AUTHORIZE_PATH,
  OAUTH_SCOPES,
  REGISTER_PATH,
  REVOKE_PATH,
  TOKEN_PATH,
} from "./config";
import { isOAuthError } from "./errors";
import { mcpResourceUrl } from "./origin";

/**
 * Respuestas HTTP de los endpoints OAuth/MCP (milestone 20).
 *
 * Estos endpoints los llama el **cliente OAuth del asistente**, no nuestra UI, así que no
 * usan el sobre `{ message }` de `src/lib/api/response.ts`: hablan el formato de cada RFC
 * (`{ error, error_description }`, metadata JSON, `WWW-Authenticate`).
 *
 * **CORS abierto** (`*`) en metadata, token, registro, revocación y MCP: los clientes web
 * (claude.ai, chatgpt.com) los llaman desde el navegador. Es seguro porque ninguno usa
 * cookies — la autorización viaja en el cuerpo (código + PKCE) o en `Authorization:
 * Bearer`, y un sitio ajeno no tiene ninguno de los dos.
 */

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Method, Mcp-Name, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

/** Agrega los headers CORS a una respuesta existente. */
export function withCors<T extends Response>(res: T): T {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

/** Respuesta al preflight `OPTIONS`. */
export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** JSON sin cache (RFC 6749 §5.1 exige `no-store` en respuestas con tokens). */
export function oauthJson(body: unknown, status = 200): NextResponse {
  return withCors(
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    }),
  );
}

/**
 * `catch` estándar de los endpoints OAuth: un {@link OAuthError} sale como
 * `{ error, error_description }` con su estado; cualquier otra cosa se loguea y sale como
 * `server_error` genérico, sin filtrar detalles internos.
 */
export function oauthCatch(context: string, err: unknown): NextResponse {
  if (isOAuthError(err)) {
    return oauthJson(
      { error: err.code, error_description: err.message },
      err.status,
    );
  }
  logger.error(context, err);
  return oauthJson(
    { error: "server_error", error_description: "Error interno del servidor" },
    500,
  );
}

/** Metadata del servidor de autorización (RFC 8414). */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}${AUTHORIZE_PATH}`,
    token_endpoint: `${origin}${TOKEN_PATH}`,
    registration_endpoint: `${origin}${REGISTER_PATH}`,
    revocation_endpoint: `${origin}${REVOKE_PATH}`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...OAUTH_SCOPES],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

/** Metadata del recurso protegido (RFC 9728): el endpoint MCP. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "La Nube",
    resource_documentation: `${origin}/user/settings/security`,
  };
}

/** URL de la metadata del recurso, la que va en `WWW-Authenticate` (RFC 9728 §5.1). */
export function protectedResourceMetadataUrl(origin: string): string {
  return `${origin}/.well-known/oauth-protected-resource/api/mcp`;
}
