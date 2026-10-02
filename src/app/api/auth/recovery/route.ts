import { verifyCaptcha } from "@/lib/auth";
import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/ratelimit";
import { redeemRecoveryCode } from "@/lib/recovery-codes/server";
import { getClientIp } from "@/lib/request-ip";
import { recoverySchema } from "@/lib/schemas/auth";
import { NextRequest } from "next/server";

/**
 * POST: recuperar la cuenta con un código de recuperación (milestone 17, público).
 * Body: `{ email, code, password, passwordConfirmation, captcha }`. Si el código vale, lo
 * consume y deja puesta la contraseña nueva; el cliente después inicia sesión con ella.
 *
 * Defensas: captcha, rate limit por IP **y** por email (los códigos tienen 60 bits de azar,
 * así que adivinar es inviable, pero el límite por email además frena a quien rote IPs), y
 * un único mensaje de error para todo fallo (no revela si el email existe).
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = recoverySchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Datos inválidos",
        400,
      );
    }
    const { email, code, password, captcha } = parsed.data;

    if (!(await verifyCaptcha(captcha))) {
      return apiError("El captcha no es válido", 400);
    }

    const ip = await getClientIp();
    if (!ip) return apiError("IP no encontrada", 400);
    const [byIp, byEmail] = await Promise.all([
      checkRateLimit(ip, "/api/auth/recovery", {
        maxAttempts: 5,
        windowMs: 60_000,
        blockDurationMs: 15 * 60_000,
      }),
      checkRateLimit(`email:${email}`, "/api/auth/recovery", {
        maxAttempts: 10,
        windowMs: 60 * 60_000,
      }),
    ]);
    if (!byIp.allowed || !byEmail.allowed) {
      return apiError(
        "Demasiados intentos. Esperá un rato y volvé a probar.",
        429,
      );
    }

    const ok = await redeemRecoveryCode({ email, code, newPassword: password });
    if (!ok) {
      return apiError(
        "El email o el código no son válidos, o el código ya se usó.",
        400,
      );
    }
    return apiSuccess({ ok: true });
  } catch (err) {
    return apiCatch("auth/recovery POST", err);
  }
}
