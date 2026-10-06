import { now, nowMs } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import { revokeAllGrantsForUser } from "@/lib/oauth/server";
import { dateToUnixMs } from "@/lib/unix-ms";
import crypto from "node:crypto";
import { bcryptHash, hash } from "../utils";
import { sendEmailConfirmation } from "@/lib/email/confirmation";
import { logger } from "@/lib/logger";

/**
 * Vida del enlace de confirmación. También es el intervalo mínimo entre dos reenvíos
 * automáticos a la misma cuenta (ver `resendEmailConfirmationIfExpired`): un atacante que
 * intente iniciar sesión o pedir un reset en loop provoca como máximo un correo por día.
 */
const TOKEN_EXPIRY_HOURS = 24;

function createToken(length: number) {
  return crypto.randomBytes(length).toString("hex");
}

export async function createEmailVerificationToken(
  email: string,
): Promise<string> {
  const token = createToken(32);
  const hashedToken = hash(token);
  const expires = now();
  expires.setHours(expires.getHours() + TOKEN_EXPIRY_HOURS);
  const expiresMs = dateToUnixMs(expires);

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashedToken,
      expires: expiresMs,
    },
  });

  return token;
}

/**
 * ¿Hay que mandar un enlace de confirmación nuevo? Solo si no queda ninguno vigente: sin
 * tokens (se consumió mal, se purgó, falló el envío original) o todos vencidos. Pura, para
 * poder testear la regla anti-spam sin base de datos.
 */
export function needsNewConfirmationLink(
  tokens: { expires: bigint | number }[],
  atMs: number,
): boolean {
  return !tokens.some((t) => Number(t.expires) >= atMs);
}

/**
 * Cuentas que se registraron y nunca confirmaron quedaban en un limbo cuando el enlace
 * vencía: no podían entrar, el reset no les llegaba (no tienen perfil) y registrarse de
 * nuevo daba "email ya registrado". Esto les manda un enlace nuevo, pero SOLO si el anterior
 * ya venció: mientras haya uno vigente no se envía nada, así nadie puede usar el login o el
 * reset para spamear el SMTP ni a una víctima.
 *
 * Quien llama debe haber comprobado ya que la cuenta existe y no está verificada, y NO debe
 * revelar al cliente si se envió (evita enumerar cuentas). Nunca lanza.
 */
export async function resendEmailConfirmationIfExpired(
  email: string,
): Promise<boolean> {
  try {
    const tokens = await prisma.verificationToken.findMany({
      where: { identifier: email },
      select: { expires: true },
    });
    if (!needsNewConfirmationLink(tokens, nowMs())) return false;
    const token = await createEmailVerificationToken(email);
    const { success, error } = await sendEmailConfirmation(email, token);
    if (!success) {
      logger.warn("confirmation resend failed", { error });
    }
    return success;
  } catch (err) {
    logger.error("resendEmailConfirmationIfExpired", err);
    return false;
  }
}

export async function consumeEmailVerificationToken(
  token: string,
): Promise<string | null> {
  const hashedToken = hash(token);
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashedToken },
  });

  if (!record) {
    return null;
  }
  const expMs = Number(record.expires);
  if (expMs < nowMs()) {
    return null;
  }

  await prisma.verificationToken.delete({
    where: { token: hashedToken },
  });

  return record.identifier;
}

/**
 * Borra los tokens de confirmación de una cuenta. Se usa cuando el envío del enlace falló:
 * un token vigente que nadie recibió bloquearía `resendEmailConfirmationIfExpired` (solo
 * reenvía si no queda ninguno vigente) y la cuenta quedaría 24 h sin poder confirmarse.
 */
export async function discardEmailVerificationTokens(
  email: string,
): Promise<void> {
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
}

export async function createResetToken(userId: string): Promise<string> {
  const token = createToken(32);
  const hashedToken = hash(token);
  await prisma.passwordResetToken.create({
    data: {
      userId,
      token: hashedToken,
      expiresAt: BigInt(nowMs() + 1000 * 60 * 60 * 24),
    },
  });

  return token;
}

/**
 * Borra un token de reseteo recién creado cuyo correo no se pudo enviar: no debe quedar un
 * enlace válido que nadie recibió. Recibe el token en claro (el que iba en el correo).
 */
export async function discardResetToken(token: string): Promise<void> {
  await prisma.passwordResetToken.deleteMany({ where: { token: hash(token) } });
}

export async function consumeResetToken(
  token: string,
  password: string,
): Promise<string | null> {
  const hashedToken = hash(token);
  const hashedPassword = await bcryptHash(password);
  return prisma.$transaction(async (tx) => {
    // `delete` lanzaba P2025 (un 500) con un token inexistente: enlace ya usado, doble envío
    // del formulario, un escáner de correo que lo abrió antes, o uno inventado. `deleteMany`
    // devuelve la cantidad, así que "no había token" es un resultado normal y el consumo sigue
    // siendo atómico (dos pedidos simultáneos: solo uno borra la fila). Al ir en la misma
    // transacción que el cambio de contraseña, si este falla el token no se pierde.
    const record = await tx.passwordResetToken.findUnique({
      where: { token: hashedToken },
    });
    if (!record) return null;
    const { count } = await tx.passwordResetToken.deleteMany({
      where: { token: hashedToken },
    });
    // Otro pedido lo consumió entre la lectura y el borrado.
    if (count === 0) return null;
    if (record.expiresAt < BigInt(nowMs())) return null;

    const updated = await tx.registeredUser.update({
      where: { id: record.userId },
      data: { user: { update: { passwordHash: hashedPassword } } },
      select: { userId: true },
    });
    // Cambiar la contraseña desconecta todos los asistentes (milestone 20): después de un
    // "me robaron la cuenta", nada de lo que estaba conectado debe seguir funcionando.
    await revokeAllGrantsForUser(updated.userId, tx);
    return record.userId;
  });
}
