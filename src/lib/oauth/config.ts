/**
 * Constantes y helpers **puros** del servidor OAuth del conector MCP (milestone 20). Sin
 * dependencias de servidor: los usa también la pantalla de consentimiento (cliente) y los
 * tests.
 *
 * La Nube es un servidor de autorización OAuth 2.1 **mínimo**: authorization code + PKCE S256
 * + refresh token rotativo, para clientes públicos (asistentes como Claude o ChatGPT). Nada
 * de `client_credentials`, `implicit`, ni OpenID Connect. Ver
 * `docs/milestones/milestones-20-mcp-connector.md`.
 */

/** Ruta del endpoint MCP. Su URL absoluta es el `resource` (RFC 8707) de todos los tokens. */
export const MCP_PATH = "/api/mcp";

/** Ruta de la pantalla de consentimiento (página, no API). */
export const AUTHORIZE_PATH = "/oauth/authorize";
export const TOKEN_PATH = "/api/oauth/token";
export const REGISTER_PATH = "/api/oauth/register";
export const REVOKE_PATH = "/api/oauth/revoke";

/**
 * Los scopes del conector. Se piden juntos en la práctica, pero separarlos deja la puerta
 * abierta a un asistente de "solo consultar".
 */
export const OAUTH_SCOPES = [
  "reservations:read",
  "reservations:write",
] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

/**
 * Qué puede hacer cada scope, en castellano llano, para la pantalla de consentimiento y
 * "Asistentes conectados". Es lo que la persona lee antes de decir "Permitir".
 */
export const SCOPE_DESCRIPTIONS: Record<OAuthScope, string[]> = {
  "reservations:read": [
    "Ver los espacios y sus horarios libres",
    "Ver tus reservas",
  ],
  "reservations:write": [
    "Pedir reservas en tu nombre (quedan pendientes de aprobación)",
    "Cancelar tus reservas",
  ],
};

/** Vida del código de autorización: 60 s, un solo uso. */
export const AUTHORIZATION_CODE_TTL_MS = 60 * 1000;
/** Vida del access token: 1 h. */
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
/** Vida del refresh token: 30 días; cada uso lo rota. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** `lastUsedAt` del grant se escribe como mucho una vez por este intervalo. */
export const GRANT_LAST_USED_THROTTLE_MS = 60 * 1000;
/** Cache de un Client ID Metadata Document antes de volver a traerlo. */
export const CIMD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Parsea el parámetro `scope` (lista separada por espacios). Ausente o vacío = todos los
 * scopes del conector (es lo que piden Claude y ChatGPT cuando no mandan `scope`). Devuelve
 * `null` si incluye alguno desconocido — se rechaza con `invalid_scope`, en lugar de
 * descartarlo en silencio.
 */
export function parseScopes(
  raw: string | null | undefined,
): OAuthScope[] | null {
  const parts = (raw ?? "").split(" ").filter(Boolean);
  if (parts.length === 0) return [...OAUTH_SCOPES];
  const known = new Set<string>(OAUTH_SCOPES);
  if (parts.some((p) => !known.has(p))) return null;
  // En el orden canónico y sin duplicados.
  return OAUTH_SCOPES.filter((s) => parts.includes(s));
}

/** true si `granted` incluye todos los de `required`. */
export function hasScopes(
  granted: readonly string[],
  required: readonly string[],
): boolean {
  return required.every((s) => granted.includes(s));
}
