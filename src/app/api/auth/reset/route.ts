import { apiCatch } from "@/lib/api/response";
import { verifyCaptcha } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { getRegisteredUserByEmail } from "@/lib/db/users";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import {
  consumeResetToken,
  createResetToken,
  discardResetToken,
  resendEmailConfirmationIfExpired,
} from "@/lib/db/verificationTokens";
import { prisma } from "@/lib/prisma";
import { sendResetEmail } from "@/lib/email/reset";
import { assertMailerAvailable } from "@/lib/email/transport";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { resetSchema } from "@/lib/schemas/auth";
import { NextRequest, NextResponse } from "next/server";

function firstZodMessage(error: { issues: { message?: string }[] }): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = resetSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { message: firstZodMessage(parsed.error) },
        { status: 400 },
      );
    }
    const { email: clientNormalizedEmail, captcha } = parsed.data;
    const isHuman = await verifyCaptcha(captcha);
    if (!isHuman) {
      return NextResponse.json(
        { message: "El captcha no es válido" },
        { status: 400 },
      );
    }
    const ip = await getClientIp();
    if (!ip) {
      return NextResponse.json(
        { message: "IP no encontrada" },
        { status: 400 },
      );
    }
    const { allowed, resetAt } = await checkRateLimit(
      ip,
      "/api/auth/reset",
      { maxAttempts: 5, windowMs: 60_000, blockDurationMs: 300_000 }, // 5 req/min, bloqueo 5 min
    );
    if (!allowed) {
      return Response.json(
        {
          message:
            "Demasiadas solicitudes. Intenta nuevamente en " +
            Math.ceil((resetAt.getTime() - nowMs()) / 1000).toString() +
            " segundos",
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (resetAt.getTime() - nowMs()) / 1000,
            ).toString(),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }
    // El único fin de este endpoint es entregar un enlace: con el correo caído se falla (503)
    // en vez de responder "enlace enviado". Va antes de buscar la cuenta para que la
    // respuesta no dependa de si el correo existe (anti-enumeración).
    await assertMailerAvailable("auth/reset POST");
    const email = await normalizeEmailForIdentityServer(clientNormalizedEmail);
    const user = await getRegisteredUserByEmail(email);
    if (!user) {
      // Sin perfil no hay reset posible. Si es una cuenta que nunca confirmó el correo,
      // lo que le sirve es un enlace de confirmación nuevo (solo si el anterior venció).
      const account = await prisma.user.findUnique({
        where: { email },
        select: { email: true, emailVerified: true },
      });
      if (account && !account.emailVerified) {
        await resendEmailConfirmationIfExpired(account.email);
      }
    } else {
      const token = await createResetToken(user.id);
      const { error } = await sendResetEmail(user.user.email, token);
      if (error) {
        // Falló entre la verificación y el envío (carrera poco probable): no se deja un
        // enlace válido que nadie recibió, y se avisa en vez de mentir.
        logger.warn("reset email failed to send", { error });
        await discardResetToken(token);
        return NextResponse.json(
          {
            message: "No pudimos enviar el correo. Intentá de nuevo más tarde.",
          },
          { status: 503 },
        );
      }
    }
    return NextResponse.json(
      { message: "Enlace de acceso enviado" },
      { status: 200 },
    );
  } catch (err) {
    return apiCatch("auth/reset POST", err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { token, password, passwordConfirmation } = await request.json();
    if (password !== passwordConfirmation) {
      return NextResponse.json(
        { message: "Las contraseñas no coinciden" },
        { status: 400 },
      );
    }
    const userId = await consumeResetToken(token, password);
    if (!userId) {
      return NextResponse.json(
        { message: "Token inválido o expirado" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Contraseña reestablecida correctamente" },
      { status: 200 },
    );
  } catch (err) {
    return apiCatch("auth/reset PATCH", err);
  }
}
