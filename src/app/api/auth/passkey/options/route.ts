import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { startPasskeyAuthentication } from "@/lib/passkeys/server";
import { NextRequest } from "next/server";

/**
 * POST: paso 1 del inicio de sesión con passkey (público). Devuelve `{ challengeId,
 * options }`; el paso 2 es `signIn("passkey", …)`, que verifica en el `authorize` del
 * proveedor (ver `src/lib/auth.ts`).
 *
 * Con rate limit por IP: cada llamada escribe una fila de desafío, así que sin límite
 * sería una forma barata de llenar la tabla.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = await getClientIp();
    if (!ip) return apiError("IP no encontrada", 400);
    const { allowed } = await checkRateLimit(ip, "/api/auth/passkey/options", {
      maxAttempts: 20,
      windowMs: 60_000,
      blockDurationMs: 300_000,
    });
    if (!allowed) {
      return apiError(
        "Demasiados intentos. Esperá unos minutos y volvé a probar.",
        429,
      );
    }
    return apiSuccess(await startPasskeyAuthentication(request));
  } catch (err) {
    return apiCatch("auth/passkey/options POST", err);
  }
}
