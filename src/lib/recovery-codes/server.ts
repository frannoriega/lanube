import "server-only";
import { createHash, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { nowMs } from "@/lib/clock";
import { hashPassword } from "@/lib/db/users";
import { normalizeEmailForIdentityServer } from "@/lib/email/identity-server";
import { DomainError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { revokeAllGrantsForUser } from "@/lib/oauth/server";
import {
  normalizeRecoveryCode,
  formatRecoveryCode,
  RECOVERY_CODE_ALPHABET,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_LENGTH,
} from "./codes";

/**
 * Códigos de recuperación (milestone 17) — ver el modelo `RecoveryCode` para el porqué de
 * cada decisión (contraseña para generarlos, SHA-256, un solo uso, regenerar borra todo).
 */

function hashCode(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

/** Un código nuevo con `crypto.randomInt` (uniforme, criptográficamente seguro). */
function generateCode(): string {
  let out = "";
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    out += RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)];
  }
  return out;
}

export interface RecoveryCodeStatus {
  /** Códigos del juego vigente (0 si nunca se generaron). */
  total: number;
  /** Los que todavía no se usaron. */
  remaining: number;
  /** Cuándo se generó el juego vigente (UNIX ms), o `null`. */
  generatedAt: bigint | null;
}

export async function getRecoveryCodeStatus(
  userId: string,
): Promise<RecoveryCodeStatus> {
  const rows = await prisma.recoveryCode.findMany({
    where: { userId },
    select: { usedAt: true, createdAt: true },
  });
  return {
    total: rows.length,
    remaining: rows.filter((r) => r.usedAt === null).length,
    generatedAt: rows.length
      ? rows.reduce(
          (max, r) => (r.createdAt > max ? r.createdAt : max),
          BigInt(0),
        )
      : null,
  };
}

/**
 * Genera un juego nuevo (borrando el anterior) y devuelve los códigos **en claro, una sola
 * vez**: no se pueden volver a ver. Exige la contraseña actual: con una sesión robada no
 * alcanza para fabricarse una forma de recuperar (= tomar) la cuenta.
 */
export async function regenerateRecoveryCodes(
  userId: string,
  currentPassword: string,
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (
    !user?.passwordHash ||
    !(await bcrypt.compare(currentPassword, user.passwordHash))
  ) {
    throw new DomainError("La contraseña no es correcta", 403);
  }

  const codes = new Set<string>();
  while (codes.size < RECOVERY_CODE_COUNT) codes.add(generateCode());
  const plain = [...codes];

  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({
      data: plain.map((code) => ({ userId, codeHash: hashCode(code) })),
    }),
  ]);
  return plain.map(formatRecoveryCode);
}

/**
 * Canjea un código: si es válido para ese email, lo marca usado y le pone la contraseña
 * nueva a la cuenta, todo en una transacción. Devuelve `false` ante cualquier fallo, **sin
 * decir cuál** (email inexistente, código inválido o ya usado) para no revelar qué cuentas
 * existen. El `updateMany ... usedAt IS NULL` hace que dos canjes simultáneos del mismo
 * código no puedan ganar los dos.
 */
export async function redeemRecoveryCode(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<boolean> {
  const normalized = normalizeRecoveryCode(input.code);
  if (!normalized) return false;
  const email = await normalizeEmailForIdentityServer(input.email);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return false;

  const passwordHash = await hashPassword(input.newPassword);
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.recoveryCode.updateMany({
      where: { userId: user.id, codeHash: hashCode(normalized), usedAt: null },
      data: { usedAt: BigInt(nowMs()) },
    });
    if (count === 0) return false;
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    // Recuperar la cuenta es el caso "me la robaron": todo asistente conectado (milestone 20)
    // deja de funcionar, en la misma transacción que la contraseña nueva.
    await revokeAllGrantsForUser(user.id, tx);
    return true;
  });
}
