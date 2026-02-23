// lib/rateLimit.ts
import { prisma } from "@/lib/prisma";

interface RateLimitConfig {
    maxAttempts: number;
    windowMs: number;       // duración de la ventana en ms
    blockDurationMs?: number; // cuánto bloquear si se excede
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
}

export async function checkRateLimit(
    ip: string,
    endpoint: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const { maxAttempts, windowMs, blockDurationMs = windowMs } = config;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    // Upsert atómico: si el registro existe y está en la ventana actual,
    // incrementa. Si venció la ventana, resetea.
    const result = await prisma.$queryRaw<Array<{
        attempts: number;
        windowStart: Date;
        blockedUntil: Date | null;
    }>>`
    INSERT INTO "RateLimit" (id, key, endpoint, attempts, "windowStart", "updatedAt")
    VALUES (gen_random_uuid(), ${ip}, ${endpoint}, 1, ${now}, ${now})
    ON CONFLICT (key, endpoint) DO UPDATE SET
      attempts = CASE
        WHEN "RateLimit"."windowStart" < ${windowStart}
          THEN 1                          -- venció la ventana, resetear
          ELSE "RateLimit".attempts + 1   -- misma ventana, incrementar
        END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" < ${windowStart}
          THEN ${now}
          ELSE "RateLimit"."windowStart"
        END,
      "blockedUntil" = CASE
        WHEN "RateLimit".attempts + 1 > ${maxAttempts} AND "RateLimit"."blockedUntil" IS NULL
          THEN ${new Date(now.getTime() + blockDurationMs)}
          ELSE "RateLimit"."blockedUntil"
        END,
      "updatedAt" = ${now}
    RETURNING attempts, "windowStart", "blockedUntil"
  `;

    const record = result[0];

    // Verificar bloqueo activo
    if (record.blockedUntil && record.blockedUntil > now) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: record.blockedUntil,
        };
    }

    const allowed = record.attempts <= maxAttempts;
    console.log(record);
    const resetAt = new Date(record.windowStart.getTime() + windowMs);

    return {
        allowed,
        remaining: Math.max(0, maxAttempts - record.attempts),
        resetAt,
    };
}