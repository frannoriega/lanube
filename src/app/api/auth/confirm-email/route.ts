import { apiCatch } from "@/lib/api/response";
import { markUserEmailVerified } from "@/lib/db/users";
import { consumeEmailVerificationToken } from "@/lib/db/verificationTokens";
import { requestOrigin } from "@/lib/oauth/origin";
import { NextRequest, NextResponse } from "next/server";

/**
 * Confirma el email con el token del enlace y redirige al ingreso con el resultado.
 *
 * La redirección se arma con el origen **público** (`X-Forwarded-Host` / `Host`), nunca con
 * `request.url`: en la imagen standalone del VPS el servidor escucha en `HOSTNAME=0.0.0.0`
 * y `request.url` vale `http://0.0.0.0:3000/...`, así que el navegador terminaba en
 * `0.0.0.0:3000` («rechazó la conexión») después de confirmar.
 */
export async function GET(request: NextRequest) {
  const signin = (query: string) =>
    NextResponse.redirect(
      new URL(`/auth/signin?${query}`, requestOrigin(request)),
    );

  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return signin("error=missing_token");
    }

    const email = await consumeEmailVerificationToken(token);

    if (!email) {
      return signin("error=invalid_or_expired_token");
    }

    const updated = await markUserEmailVerified(email);

    if (!updated) {
      return signin("error=verification_failed");
    }

    return signin("confirmed=1");
  } catch (err) {
    return apiCatch("auth/confirm-email GET", err);
  }
}
