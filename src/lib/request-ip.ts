import "server-only";
import { headers } from "next/headers";

/**
 * La IP del cliente, para usar como clave de rate limit.
 *
 * **En qué headers confiar es el sentido completo de este archivo.** Había cuatro call sites
 * resolviendo la IP por su cuenta, todos con el mismo orden: `cf-connecting-ip ?? x-real-ip ??
 * (solo en dev) x-forwarded-for`. `cf-connecting-ip` es un header de Cloudflare, y el destino
 * de deploy es Vercel, que no filtra los headers de request desconocidos — así que llegaba
 * enteramente controlado por el cliente y se confiaba en él **primero**. Rotándolo en cada
 * request, todo endpoint con rate limit quedaba con presupuesto infinito: registro, reset de
 * contraseña, envío del formulario público y subida de archivos de participantes
 * (milestone-12 D13). Además llenaba `rate_limits` con una fila por valor falsificado, porque
 * `checkRateLimit` usa esto como clave.
 *
 * Entonces: solo se confía en headers que pone la *plataforma*. En Vercel eso es `x-real-ip` y
 * `x-forwarded-for`, que se reescriben en el edge en cada request. `cf-connecting-ip` se lee
 * **solo** cuando `TRUST_CF_CONNECTING_IP=true` declara que el deploy realmente está detrás de
 * Cloudflare — si se lo pone ahí, hay que setear la variable; hasta entonces el header es
 * entrada de un atacante.
 *
 * Devuelve null cuando no hay ningún header de plataforma, y quien llama debe tratarlo como
 * "no se puede aplicar rate limit" y rechazar: fallar abierto acá es justamente lo que lograba
 * el spoofing.
 */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();

  if (process.env.TRUST_CF_CONNECTING_IP === "true") {
    const cf = h.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
  }

  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // El valor de más a la izquierda es el cliente original; la plataforma reescribe este
  // header, así que ese valor no es elegido por el atacante como sí lo sería un header
  // desconocido.
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  // En desarrollo local no hay ningún proxy adelante.
  return process.env.NODE_ENV === "development" ? "127.0.0.1" : null;
}
