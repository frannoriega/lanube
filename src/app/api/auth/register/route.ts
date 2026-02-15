import { createUser } from "@/lib/db/users";
import { createEmailVerificationToken } from "@/lib/db/verificationTokens";
import { sendEmailConfirmation } from "@/lib/email/confirmation";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

async function verifyCaptcha(captcha: string): Promise<boolean> {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY ?? "1x0000000000000000000000000000000AA",
      response: captcha,
    }),
  })

  const data = await res.json()
  return data.success === true
}

export async function POST(request: NextRequest) {
  const { email, password, passwordConfirmation, captcha } = await request.json();
  console.log(captcha)
  const isHuman = await verifyCaptcha(captcha)
  if (!isHuman) {
    return NextResponse.json({ message: "El captcha no es válido" }, { status: 400 })
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
