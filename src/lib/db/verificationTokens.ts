import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

const TOKEN_EXPIRY_HOURS = 24;

export async function createEmailVerificationToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date();
  expires.setHours(expires.getHours() + TOKEN_EXPIRY_HOURS);

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  return token;
}

export async function consumeEmailVerificationToken(
  token: string
): Promise<string | null> {
  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || record.expires < new Date()) {
    return null;
  }

  await prisma.verificationToken.delete({
    where: { token },
  });

  return record.identifier;
}
