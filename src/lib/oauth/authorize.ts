import "server-only";
import type { OAuthClient } from "@/generated/prisma/client";
import { type OAuthScope, parseScopes } from "./config";
import { resolveClient } from "./clients";
import { isValidS256Challenge } from "./crypto";
import { isOurResource, mcpResourceUrl } from "./origin";
import { matchesRegisteredRedirectUri } from "./redirect-uri";

/**
 * Validación de un pedido de autorización (`/oauth/authorize?…`), compartida por la página
 * de consentimiento y por `POST /api/oauth/authorize` (el "Permitir"): la API **vuelve a
 * validar todo**, nunca confía en lo que mostró la página.
 *
 * El orden importa (RFC 6749 §4.1.2.1): mientras `client_id` o `redirect_uri` no estén
 * validados, un error se muestra **en pantalla** y nunca se redirige — si no, el endpoint
 * sería un open redirect hacia cualquier URL que alguien ponga en el link. Recién con los dos
 * validados, los demás errores vuelven al cliente como `?error=…&state=…`.
 */

export interface AuthorizationParams {
  response_type?: string | null;
  client_id?: string | null;
  redirect_uri?: string | null;
  code_challenge?: string | null;
  code_challenge_method?: string | null;
  scope?: string | null;
  state?: string | null;
  resource?: string | null;
}

export type AuthorizationValidation =
  /** No se puede confiar en a dónde volver: mostrar el error, no redirigir. */
  | { kind: "fatal"; message: string }
  /** Error que se le devuelve al cliente por su `redirect_uri`. */
  | { kind: "redirect"; redirectTo: string }
  | {
      kind: "ok";
      client: OAuthClient;
      redirectUri: string;
      scopes: OAuthScope[];
      codeChallenge: string;
      resource: string;
      state: string | null;
    };

/**
 * Arma la URL de vuelta al cliente con `params`, preservando la query que ya tenga la
 * `redirect_uri` registrada. Agrega `iss` (RFC 9207) para que el cliente sepa qué servidor
 * respondió — protege contra mix-up si el cliente habla con varios.
 */
export function buildClientRedirect(
  redirectUri: string,
  issuer: string,
  params: Record<string, string | null | undefined>,
): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params))
    if (v) url.searchParams.set(k, v);
  url.searchParams.set("iss", issuer);
  return url.toString();
}

export async function validateAuthorizationRequest(
  params: AuthorizationParams,
  origin: string,
): Promise<AuthorizationValidation> {
  if (!params.client_id)
    return {
      kind: "fatal",
      message:
        "El pedido no indica qué aplicación quiere conectarse (falta client_id).",
    };
  const client = await resolveClient(params.client_id);
  if (!client)
    return {
      kind: "fatal",
      message:
        "No reconocemos la aplicación que quiere conectarse. Volvé a intentarlo desde tu asistente.",
    };

  // Sin `redirect_uri` solo se admite si el cliente registró exactamente una.
  const redirectUri =
    params.redirect_uri ??
    (client.redirectUris.length === 1 ? client.redirectUris[0] : null);
  if (
    !redirectUri ||
    !matchesRegisteredRedirectUri(client.redirectUris, redirectUri)
  )
    return {
      kind: "fatal",
      message:
        "La dirección de retorno no coincide con la que registró la aplicación. Por seguridad, no continuamos.",
    };

  const state = params.state ?? null;
  const fail = (error: string, description: string) => ({
    kind: "redirect" as const,
    redirectTo: buildClientRedirect(redirectUri, origin, {
      error,
      error_description: description,
      state,
    }),
  });

  if (params.response_type !== "code")
    return fail("unsupported_response_type", "Solo response_type=code");
  if (params.code_challenge_method !== "S256")
    return fail(
      "invalid_request",
      "PKCE con code_challenge_method=S256 es obligatorio",
    );
  if (!params.code_challenge || !isValidS256Challenge(params.code_challenge))
    return fail("invalid_request", "code_challenge inválido");
  const scopes = parseScopes(params.scope);
  if (!scopes) return fail("invalid_scope", "Scope desconocido");
  if (params.resource && !isOurResource(params.resource, origin))
    return fail(
      "invalid_target",
      "Este servidor solo autoriza su endpoint MCP",
    );

  return {
    kind: "ok",
    client,
    redirectUri,
    scopes,
    codeChallenge: params.code_challenge,
    resource: mcpResourceUrl(origin),
    state,
  };
}
