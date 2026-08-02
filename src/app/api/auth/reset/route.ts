import { verifyCaptcha } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { getRegisteredUserByEmail } from "@/lib/db/users";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import {
  consumeResetToken,
  createResetToken,
} from "@/lib/db/verificationTokens";
import { sendResetEmail } from "@/lib/email/reset";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/ratelimit";
import { resetSchema } from "@/lib/schemas/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function firstZodMessage(error: { issues: { message?: string }[] }): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

export async function POST(request: NextRequest) {
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
  const headersList = await headers();
  const ip =
    headersList.get("cf-connecting-ip") ??
    headersList.get("x-real-ip") ??
    (process.env.NODE_ENV === "development"
      ? (headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
        "127.0.0.1")
      : null);
  if (!ip) {
    return NextResponse.json({ message: "IP no encontrada" }, { status: 400 });
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
  const email = await normalizeEmailForIdentityServer(clientNormalizedEmail);
  const user = await getRegisteredUserByEmail(email);
  if (user) {
    const token = await createResetToken(user.id);
    const { error } = await sendResetEmail(user.user.email, token);
    if (error) {
      logger.warn("reset email failed to send", { error });
    }
  }
  return NextResponse.json(
    { message: "Enlace de acceso enviado" },
    { status: 200 },
  );
}

export async function PATCH(request: NextRequest) {
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
}
