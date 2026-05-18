import { now, nowMs } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import { dateToUnixMs } from "@/lib/unix-ms";
import crypto from "node:crypto";
import { bcryptHash, hash } from "../utils";

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

export async function consumeResetToken(
  token: string,
  password: string,
): Promise<string | null> {
  const hashedToken = hash(token);
  const record = await prisma.passwordResetToken.delete({
    where: { token: hashedToken },
  });
  if (!record || record.expiresAt < BigInt(nowMs())) {
    return null;
  }
  const hashedPassword = await bcryptHash(password);
  await prisma.registeredUser.update({
    where: { id: record.userId },
    data: {
      user: {
        update: {
          passwordHash: hashedPassword,
        },
      },
    },
  });
  return record.userId;
}
