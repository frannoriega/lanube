/**
 * Piezas compartidas del gate de políticas (milestone 19): la ruta de la pantalla y la
 * validación del `next` al que se vuelve después de aceptar. Puro, sin dependencias de
 * servidor: lo usan el middleware, los layouts, la página y la pantalla de cliente.
 */

/** La pantalla "Actualizamos nuestras políticas". */
export const POLICY_GATE_PATH = "/policies/accept";

/** A dónde se va después de aceptar si `next` falta o no es válido. */
export const POLICY_GATE_DEFAULT_NEXT = "/user/dashboard";

/**
 * Header con el que el middleware le pasa la ruta pedida a los layouts de servidor (que no la
 * conocen), para que el gate sepa a dónde volver.
 */
export const PATHNAME_HEADER = "x-lanube-pathname";

/**
 * Prefijos a los que se puede volver: lo que el gate frena. `/oauth/authorize` es la
 * pantalla de consentimiento del conector MCP (milestone 20).
 */
const ALLOWED_PREFIXES = [
  "/user",
  "/admin",
  "/auth/signup",
  "/oauth/authorize",
];

/**
 * El `next` validado: solo rutas internas de la zona que el gate frena. Cualquier otra cosa
 * (`//evil.com`, `https://…`, `/\evil.com`, rutas públicas, el propio gate) cae en el
 * default — si no, `/policies/accept?next=…` sería un open redirect.
 */
export function safeGateNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return POLICY_GATE_DEFAULT_NEXT;
  }
  if (raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) {
    return POLICY_GATE_DEFAULT_NEXT;
  }
  const path = raw.split(/[?#]/)[0];
  const allowed = ALLOWED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  return allowed ? raw : POLICY_GATE_DEFAULT_NEXT;
}

/** La URL del gate con su `next` (ya validado). */
export function policyGateUrl(next: string | null | undefined): string {
  const safe = safeGateNext(next);
  return safe === POLICY_GATE_DEFAULT_NEXT
    ? POLICY_GATE_PATH
    : `${POLICY_GATE_PATH}?next=${encodeURIComponent(safe)}`;
}
