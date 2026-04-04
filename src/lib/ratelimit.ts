// lib/rateLimit.ts
import { now } from "@/lib/clock";
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
  const at = now();
  const windowStart = new Date(at.getTime() - windowMs);

  // Upsert atómico: si el registro existe y está en la ventana actual,
  // incrementa. Si venció la ventana, resetea.
  const result = await prisma.$queryRaw<Array<{
    attempts: number;
    windowStart: Date;
    blockedUntil: Date | null;
  }>>`
    INSERT INTO rate_limits (id, key, endpoint, attempts, "windowStart", "updatedAt")
    VALUES (gen_random_uuid(), ${ip}, ${endpoint}, 1, ${at}, ${at})
    ON CONFLICT (key, endpoint) DO UPDATE SET
      attempts = CASE
        WHEN rate_limits."windowStart" < ${windowStart}
          THEN 1                          -- venció la ventana, resetear
          ELSE rate_limits.attempts + 1   -- misma ventana, incrementar
        END,
      "windowStart" = CASE
        WHEN rate_limits."windowStart" < ${windowStart}
          THEN ${at}
          ELSE rate_limits."windowStart"
        END,
      "blockedUntil" = CASE
        WHEN rate_limits.attempts + 1 > ${maxAttempts} AND rate_limits."blockedUntil" IS NULL
          THEN ${new Date(at.getTime() + blockDurationMs)}
          ELSE rate_limits."blockedUntil"
        END,
      "updatedAt" = ${at}
    RETURNING attempts, "windowStart", "blockedUntil"
  `;

  const record = result[0];

  // Verificar bloqueo activo
  if (record.blockedUntil && record.blockedUntil > at) {
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