import { Prisma } from "@/generated/prisma/client";
import { nowMs } from "@/lib/clock";
import { verifyCaptcha } from "@/lib/auth";
import { recordPolicyAcceptances } from "@/lib/db/policies";
import { createUser } from "@/lib/db/users";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import { createEmailVerificationToken } from "@/lib/db/verificationTokens";
import { sendEmailConfirmation } from "@/lib/email/confirmation";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/request-ip";
import { logger } from "@/lib/logger";
import { getAcceptanceEvidence } from "@/lib/policies/evidence";
import {
  checkSubmittedAcceptances,
  pendingPolicies,
} from "@/lib/policies/pending";
import { POLICIES } from "@/lib/policies/registry";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/schemas/auth";
import { NextRequest, NextResponse } from "next/server";

function firstZodMessage(error: { issues: { message?: string }[] }): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { message: firstZodMessage(parsed.error) },
      { status: 400 },
    );
  }

  const {
    email: displayRaw,
    password,
    captcha,
    acceptedPolicies,
  } = parsed.data;

  const isHuman = await verifyCaptcha(captcha);
  if (!isHuman) {
    return NextResponse.json(
      { message: "El captcha no es válido" },
      { status: 400 },
    );
  }
  const ip = await getClientIp();
  if (!ip) {
    return NextResponse.json({ message: "IP no encontrada" }, { status: 400 });
  }
  const { allowed, resetAt } = await checkRateLimit(
    ip,
    "/api/auth/register",
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

  // Políticas (milestone 19): una cuenta nueva no aceptó nada, así que lo pendiente es todo lo
  // que hoy exige aceptación. 400 si falta alguna; 409 si la persona aceptó una versión que
  // cambió mientras tenía el formulario abierto (el form recarga y se la muestra de nuevo).
  const policyCheck = checkSubmittedAcceptances(
    pendingPolicies(POLICIES, [], nowMs()),
    acceptedPolicies,
  );
  if (!policyCheck.ok) {
    return NextResponse.json(
      {
        message: policyCheck.message,
        ...(policyCheck.status === 409 && { code: "POLICIES_CHANGED" }),
      },
      { status: policyCheck.status },
    );
  }
  const evidence = await getAcceptanceEvidence();

  const email = await normalizeEmailForIdentityServer(displayRaw);

  try {
    // Cuenta y consentimiento en una sola transacción: no puede quedar una sin el otro.
    await prisma.$transaction(async (tx) => {
      const user = await createUser(email, password, displayRaw, tx);
      await recordPolicyAcceptances(
        tx,
        user.id,
        policyCheck.accepted,
        "SIGNUP",
        evidence,
      );
    });
    const token = await createEmailVerificationToken(email);
    const { success, error } = await sendEmailConfirmation(email, token);

    if (!success) {
      return NextResponse.json(
        {
          message:
            error ??
            "Cuenta creada pero no pudimos enviar el email de confirmación. Intenta iniciar sesión más tarde.",
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
    logger.error("auth/register POST", error);
    return NextResponse.json(
      { message: "Error al crear la cuenta" },
      { status: 500 },
    );
  }
}
