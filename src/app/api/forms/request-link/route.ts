import { apiCatch, apiError, apiSuccess } from "@/lib/api/response";
import { verifyCaptcha } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import { sendFreshEditLinks } from "@/lib/email/event-edit-links";
import { assertMailerAvailable } from "@/lib/email/transport";
import { logger } from "@/lib/logger";
import { areEventEmailsSuspended } from "@/lib/maintenance/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { editLinkRequestSchema } from "@/lib/schemas/events";
import { after, NextRequest } from "next/server";

/** Lo que se responde siempre que el pedido es válido, haya o no inscripciones. */
const GENERIC_OK =
  "Si tenés inscripciones activas con ese correo, te mandamos un enlace nuevo para cada una. Revisá también la carpeta de spam.";

/**
 * «Pedir un enlace nuevo» para gestionar una inscripción (milestone 25, S5). Público.
 *
 * Mismo molde que `POST /api/auth/reset`: captcha, rate limit por IP **y por correo** (este
 * endpoint manda correos a una dirección que elige quien llama: sin tope por destinatario,
 * serviría para llenarle la casilla a otra persona), y correo disponible antes de mirar nada.
 *
 * **No revela si el correo estaba inscripto:** la respuesta es la misma con y sin inscripciones,
 * y el envío corre con `after()` — después de responder — para que el tiempo de respuesta
 * tampoco lo delate (armar y mandar el correo tarda; no hacer nada, no).
 */
export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = editLinkRequestSchema.safeParse(json);
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Datos inválidos",
        400,
      );
    }
    if (!(await verifyCaptcha(parsed.data.captcha))) {
      return apiError("El captcha no es válido", 400);
    }
    const ip = await getClientIp();
    if (!ip) return apiError("IP no encontrada", 400);

    const email = await normalizeEmailForIdentityServer(parsed.data.email);
    const [byIp, byEmail] = await Promise.all([
      checkRateLimit(ip, "/api/forms/request-link", {
        maxAttempts: 5,
        windowMs: 60_000,
        blockDurationMs: 5 * 60_000,
      }),
      checkRateLimit(`email:${email}`, "/api/forms/request-link", {
        maxAttempts: 3,
        windowMs: 60 * 60_000,
      }),
    ]);
    if (!byIp.allowed || !byEmail.allowed) {
      const resetAt = Math.max(
        byIp.allowed ? 0 : byIp.resetAt.getTime(),
        byEmail.allowed ? 0 : byEmail.resetAt.getTime(),
      );
      const seconds = Math.max(1, Math.ceil((resetAt - nowMs()) / 1000));
      return apiError(
        `Demasiadas solicitudes. Intentá nuevamente en ${seconds} segundos`,
        429,
      );
    }

    // Mantenimiento (milestone 22): con los correos de eventos apagados no hay nada que mandar;
    // se dice, en vez de responder «te lo mandamos». No depende del correo pedido.
    if (await areEventEmailsSuspended()) {
      return apiError(
        "Por mantenimiento no estamos enviando correos de eventos. Probá de nuevo más tarde.",
        503,
        { code: "MAINTENANCE" },
      );
    }
    await assertMailerAvailable("forms/request-link POST");

    after(async () => {
      try {
        const sent = await sendFreshEditLinks(parsed.data.email);
        logger.info("edit links requested", { sent });
      } catch (err) {
        logger.error("edit links request failed", err);
      }
    });
    return apiSuccess({ message: GENERIC_OK });
  } catch (err) {
    return apiCatch("forms/request-link POST", err);
  }
}
