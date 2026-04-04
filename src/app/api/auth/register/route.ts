import { Prisma } from "@/generated/prisma/client";
import { nowMs } from "@/lib/clock";
import { verifyCaptcha } from "@/lib/auth";
import { createUser } from "@/lib/db/users";
import { createEmailVerificationToken } from "@/lib/db/verificationTokens";
import { sendEmailConfirmation } from "@/lib/email/confirmation";
import { checkRateLimit } from "@/lib/ratelimit";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email, password, passwordConfirmation, captcha } = await request.json();
  const isHuman = await verifyCaptcha(captcha)
  if (!isHuman) {
    return NextResponse.json({ message: "El captcha no es válido" }, { status: 400 })
  }
  const headersList = await headers();
  const ip =
    headersList.get("cf-connecting-ip") ??
    headersList.get("x-real-ip") ??
    (process.env.NODE_ENV === "development"
      ? (headersList.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1")
      : null);
  if (!ip) {
    return NextResponse.json({ message: "IP no encontrada" }, { status: 400 });
  }
  const { allowed, resetAt } = await checkRateLimit(
    ip,
    "/api/auth/register",
    { maxAttempts: 5, windowMs: 60_000, blockDurationMs: 300_000 } // 5 req/min, bloqueo 5 min
  );
  if (!allowed) {
    return Response.json(
      { message: "Demasiadas solicitudes. Intenta nuevamente en " + Math.ceil((resetAt.getTime() - nowMs()) / 1000).toString() + " segundos" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((resetAt.getTime() - nowMs()) / 1000).toString(),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }
  if (password !== passwordConfirmation) {
    return NextResponse.json(
      { message: "Las contraseñas no coinciden" },
      { status: 400 },
    );
  }
  try {
    await createUser(email, password);
    const token = await createEmailVerificationToken(email);
    const { success, error } = await sendEmailConfirmation(email, token);

    if (!success) {
      return NextResponse.json(
        {
          message:
            error ?? "Cuenta creada pero no pudimos enviar el email de confirmación. Intenta iniciar sesión más tarde.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        message:
          "Cuenta creada. Revisa tu correo para confirmar tu email y continuar.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { message: "El email ya está registrado" },
          { status: 409 },
        );
      }
    }
    return NextResponse.json(
      { message: "Error al crear la cuenta" },
      { status: 500 },
    );
  }
}
