import { apiCatch } from "@/lib/api/response";
import { markUserEmailVerified } from "@/lib/db/users";
import { consumeEmailVerificationToken } from "@/lib/db/verificationTokens";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL("/auth/signin?error=missing_token", request.url),
      );
    }

    const email = await consumeEmailVerificationToken(token);

    if (!email) {
      return NextResponse.redirect(
        new URL("/auth/signin?error=invalid_or_expired_token", request.url),
      );
    }

    const updated = await markUserEmailVerified(email);

    if (!updated) {
      return NextResponse.redirect(
        new URL("/auth/signin?error=verification_failed", request.url),
      );
    }

    return NextResponse.redirect(
      new URL("/auth/signin?confirmed=1", request.url),
    );
  } catch (err) {
    return apiCatch("auth/confirm-email GET", err);
  }
}
