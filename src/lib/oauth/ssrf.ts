import { isIP } from "node:net";

/**
 * Protección SSRF para traer un Client ID Metadata Document (milestone 20). Con CIMD el
 * `client_id` es una URL **que elige un tercero** y nuestro servidor la va a buscar: sin
 * esto, cualquiera podría hacer que La Nube pidiera `http://169.254.169.254/…` (metadata de
 * la nube) o un servicio interno de la red del VPS.
 *
 * Puro y testeado: la resolución DNS la hace `cimd.ts` y le pasa las IPs a esta función.
 */

/** ¿Es una dirección a la que nunca hay que conectarse desde el servidor? */
export function isPrivateAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 || // "esta red"
      a === 10 || // privada
      a === 127 || // loopback
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local (metadata de la nube)
      (a === 172 && b >= 16 && b <= 31) || // privada
      (a === 192 && b === 168) || // privada
      (a === 192 && b === 0) || // IETF / TEST-NET-1
      (a === 198 && (b === 18 || b === 19)) || // benchmarking
      a >= 224 // multicast + reservada + broadcast
    );
  }
  if (kind === 6) {
    const lower = address.toLowerCase();
    // IPv4 mapeada (::ffff:10.0.0.1): se juzga por la IPv4.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") || // ULA fc00::/7
      lower.startsWith("fd") ||
      /^fe[89ab]/.test(lower) || // link-local fe80::/10
      lower.startsWith("ff") // multicast
    );
  }
  // No es una IP: el llamador tiene que resolverla primero.
  return true;
}

/**
 * ¿Es una URL aceptable como `client_id` CIMD? `https`, sin credenciales, sin fragmento, con
 * path (la spec exige un path, no solo el host), y sin puerto raro.
 */
export function isAcceptableCimdUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password || url.hash) return false;
  if (url.pathname === "/" || url.pathname === "") return false;
  if (url.port && url.port !== "443") return false;
  // Un literal IP privado se rechaza ya; un hostname se valida al resolverlo.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateAddress(host)) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  return true;
}
