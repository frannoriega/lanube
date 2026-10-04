/**
 * `callbackUrl` del ingreso (milestone 20, slice 2): a dónde volver después de iniciar sesión.
 *
 * Hasta el milestone 20 el ingreso siempre iba a `/user/dashboard`. El flujo OAuth del
 * conector MCP necesita "ingresá y volvé a la pantalla de autorización con todos sus
 * parámetros", así que el ingreso ahora respeta `?callbackUrl=`. Puro y sin dependencias de
 * servidor: lo usan el middleware y la pantalla de ingreso (cliente).
 *
 * Mismo criterio que `safeGateNext` (gate de políticas): **solo rutas internas de una lista
 * de prefijos**. Cualquier otra cosa (`//evil.com`, `https://…`, `/\evil.com`, caracteres de
 * control) cae en el default — si no, `/auth/signin?callbackUrl=…` sería un open redirect.
 */

/** A dónde se va después de ingresar si `callbackUrl` falta o no es válido. */
export const SIGNIN_DEFAULT_CALLBACK = "/user/dashboard";

/** La pantalla de consentimiento OAuth (milestone 20). */
export const OAUTH_AUTHORIZE_PATH = "/oauth/authorize";

/** Prefijos a los que se puede volver después de ingresar. */
const ALLOWED_PREFIXES = ["/user", "/admin", OAUTH_AUTHORIZE_PATH];

export function safeCallbackUrl(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return SIGNIN_DEFAULT_CALLBACK;
  }
  if (raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) {
    return SIGNIN_DEFAULT_CALLBACK;
  }
  const path = raw.split(/[?#]/)[0];
  const allowed = ALLOWED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  return allowed ? raw : SIGNIN_DEFAULT_CALLBACK;
}

/** La URL del ingreso con su `callbackUrl` (ya validado). */
export function signInUrl(callbackUrl: string | null | undefined): string {
  const safe = safeCallbackUrl(callbackUrl);
  return safe === SIGNIN_DEFAULT_CALLBACK
    ? "/auth/signin"
    : `/auth/signin?callbackUrl=${encodeURIComponent(safe)}`;
}
