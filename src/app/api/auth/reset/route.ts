import { verifyCaptcha } from "@/lib/auth";
import { nowMs } from "@/lib/clock";
import { getRegisteredUserByEmail } from "@/lib/db/users";
import { consumeResetToken, createResetToken } from "@/lib/db/verificationTokens";
import { sendResetEmail } from "@/lib/email/reset";
import { checkRateLimit } from "@/lib/ratelimit";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    const { email, captcha } = await request.json();
    const isHuman = await verifyCaptcha(captcha);
    if (!isHuman) {
        return NextResponse.json({ message: "El captcha no es válido" }, { status: 400 });
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
        "/api/auth/reset",
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
    const user = await getRegisteredUserByEmail(email);
    if (user) {
        const token = await createResetToken(user.user.id);
        const { success, error } = await sendResetEmail(email, token);
        if (!success) {
            return NextResponse.json({ message: error }, { status: 500 });
        }
    }
    return NextResponse.json({ message: "Enlace de acceso enviado" }, { status: 200 });
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
        return NextResponse.json({ message: "Token inválido o expirado" }, { status: 400 });
    }
}