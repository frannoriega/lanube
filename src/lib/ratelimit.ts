// lib/rateLimit.ts
import { now } from "@/lib/clock";
import { prisma } from "@/lib/prisma";

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export async function checkRateLimit(
  ip: string,
  endpoint: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const { maxAttempts, windowMs, blockDurationMs = windowMs } = config;
  const at = now();
  const atMs = BigInt(at.getTime());
  const windowStartMs = BigInt(at.getTime() - windowMs);
  const blockUntilMs = BigInt(at.getTime() + blockDurationMs);

  const result = await prisma.$queryRaw<
    Array<{
      attempts: number;
      windowStart: bigint;
      blockedUntil: bigint | null;
    }>
  >`
    INSERT INTO rate_limits (id, key, endpoint, attempts, "windowStart", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), ${ip}, ${endpoint}, 1, ${atMs}, ${atMs}, ${atMs})
    ON CONFLICT (key, endpoint) DO UPDATE SET
      attempts = CASE
        WHEN rate_limits."windowStart" < ${windowStartMs}
          THEN 1
          ELSE rate_limits.attempts + 1
        END,
      "windowStart" = CASE
        WHEN rate_limits."windowStart" < ${windowStartMs}
          THEN ${atMs}
          ELSE rate_limits."windowStart"
        END,
      "blockedUntil" = CASE
        WHEN rate_limits.attempts + 1 > ${maxAttempts} AND rate_limits."blockedUntil" IS NULL
          THEN ${blockUntilMs}
          ELSE rate_limits."blockedUntil"
        END,
      "updatedAt" = ${atMs}
    RETURNING attempts, "windowStart", "blockedUntil"
  `;

  const record = result[0];
  const blockedUntil =
    record.blockedUntil != null ? new Date(Number(record.blockedUntil)) : null;

  if (blockedUntil && blockedUntil > at) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: blockedUntil,
    };
  }

  const allowed = record.attempts <= maxAttempts;
  const resetAt = new Date(Number(record.windowStart) + windowMs);

  return {
    allowed,
    remaining: Math.max(0, maxAttempts - record.attempts),
    resetAt,
  };
}
