/**
 * Reglas de `redirect_uri` del servidor OAuth (milestone 20). Puro y testeado: es la pieza
 * donde un descuido convierte el servidor en un open redirect o en un robo de códigos.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parse(uri: string): URL | null {
  try {
    return new URL(uri);
  } catch {
    return null;
  }
}

function isLoopback(url: URL): boolean {
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * ¿Se puede **registrar** esta `redirect_uri`? (DCR o CIMD)
 *
 * - `https://…` siempre (los clientes web: `https://claude.ai/api/mcp/auth_callback`).
 * - `http://` solo a loopback (clientes nativos como Claude Code o Claude Desktop, RFC 8252
 *   §7.3), nunca a un host de red.
 * - Esquemas privados de apps nativas (`com.example.app:/callback`, RFC 8252 §7.1), pero no
 *   `javascript:`, `data:`, `file:` ni similares.
 * - Nunca con fragmento (`#`), que OAuth prohíbe.
 */
export function isRegistrableRedirectUri(uri: string): boolean {
  const url = parse(uri);
  if (!url || url.hash) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return isLoopback(url);
  const scheme = url.protocol.slice(0, -1);
  if (
    ["javascript", "data", "file", "vbscript", "about", "blob"].includes(scheme)
  )
    return false;
  // Esquema privado: al menos un punto (dominio invertido), como pide RFC 8252.
  return scheme.includes(".");
}

/**
 * ¿`requested` coincide con alguna de las `registered`?
 *
 * **Coincidencia exacta** de string (OAuth 2.1 §2.3.1), con una sola excepción: para
 * redirecciones a loopback `http://`, el puerto no se compara (RFC 8252 §7.3), porque las
 * apps nativas abren un puerto efímero distinto en cada inicio de sesión.
 */
export function matchesRegisteredRedirectUri(
  registered: readonly string[],
  requested: string,
): boolean {
  if (registered.includes(requested)) return true;
  const req = parse(requested);
  if (!req || !isLoopback(req)) return false;
  return registered.some((r) => {
    const reg = parse(r);
    return (
      !!reg &&
      isLoopback(reg) &&
      reg.hostname === req.hostname &&
      reg.pathname === req.pathname &&
      reg.search === req.search
    );
  });
}

/** Dominio a mostrar en la pantalla de consentimiento (lo único verificable del cliente). */
export function redirectUriDisplayHost(uri: string): string {
  const url = parse(uri);
  if (!url) return uri;
  return url.host || url.protocol.slice(0, -1);
}
