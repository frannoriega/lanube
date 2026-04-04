import { now, nowMs } from "@/lib/clock";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { bcryptHash, hash } from "../utils";

const TOKEN_EXPIRY_HOURS = 24;

function createToken(length: number) {
  return crypto.randomBytes(length).toString("hex");
}

export async function createEmailVerificationToken(email: string): Promise<string> {
  const token = createToken(32);
  const hashedToken = hash(token);
  const expires = now();
  expires.setHours(expires.getHours() + TOKEN_EXPIRY_HOURS);

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashedToken,
      expires,
    },
  });

  return token;
}

export async function consumeEmailVerificationToken(
  token: string
): Promise<string | null> {
  const hashedToken = hash(token);
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashedToken },
  });

  if (!record || record.expires < now()) {
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
  const data = await prisma.passwordResetToken.create({
    data: {
      userId,
      token: hashedToken,
      expiresAt: new Date(nowMs() + 1000 * 60 * 60 * 24),
    },
  });
  return data.token;
}

export async function consumeResetToken(token: string, password: string): Promise<string | null> {
  const hashedToken = hash(token);
  const record = await prisma.passwordResetToken.delete({
    where: { token: hashedToken },
  });
  if (!record || record.expiresAt < now()) {
    return null;
  }
  const hashedPassword = await bcryptHash(password);
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash: hashedPassword },
  });
  return record.userId;
}