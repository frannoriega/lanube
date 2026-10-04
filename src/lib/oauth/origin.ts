import { MCP_PATH } from "./config";

/**
 * El origen público de La Nube para esta request (`https://lanube.example`), que es a la vez
 * el **issuer** del servidor de autorización y la base del `resource` del endpoint MCP.
 *
 * Mismo criterio que `relyingParty()` de las passkeys (milestone 17): se lee de
 * `X-Forwarded-Host` / `Host` (+ `X-Forwarded-Proto`), **no** de `request.url`, que bajo
 * `next dev -H 0.0.0.0` dice `0.0.0.0`. Así funciona sin configurar nada en local, en cada
 * preview de Vercel, en producción y detrás del reverse proxy de un VPS (siempre que el
 * proxy pase esos encabezados, que es lo estándar). `OAUTH_ISSUER` lo fija a mano si un proxy
 * reescribiera el host.
 *
 * Un `Host` falsificado no sirve para nada: los tokens quedan atados al `resource` con el que
 * se emitieron, y el endpoint MCP solo acepta los del suyo.
 */
export function publicOrigin(headers: Headers, fallbackUrl?: string): string {
  const fixed = process.env.OAUTH_ISSUER;
  if (fixed) return fixed.replace(/\/+$/, "");
  const fallback = fallbackUrl ? new URL(fallbackUrl) : null;
  const host =
    headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headers.get("host") ||
    fallback?.host ||
    "localhost:3000";
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    fallback?.protocol.replace(":", "") ||
    "http";
  return `${proto}://${host}`;
}

/** El origen para una `Request` de un route handler. */
export function requestOrigin(request: Request): string {
  return publicOrigin(request.headers, request.url);
}

/** URL absoluta del endpoint MCP: el `resource` (RFC 8707) de los tokens. */
export function mcpResourceUrl(origin: string): string {
  return `${origin}${MCP_PATH}`;
}

/**
 * Compara un `resource` pedido con el nuestro, tolerando una barra final (algunos clientes
 * normalizan `https://host/api/mcp/`).
 */
export function isOurResource(requested: string, origin: string): boolean {
  return requested.replace(/\/+$/, "") === mcpResourceUrl(origin);
}
