/**
 * One-off: rewrite users.email (and matching verification_tokens.identifier) to canonical form.
 * Run: npm run db:normalize-emails
 * Requires DATABASE_URL (e.g. via .env).
 *
 * Exits with code 1 if two users would collapse to the same email (manual resolution required).
 */

import "dotenv/config";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeEmailForIdentityServer } from "../src/lib/email/identity-server";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });

  const idToNew = new Map<string, string>();
  for (const u of users) {
    const next = await normalizeEmailForIdentityServer(u.email);
    idToNew.set(u.id, next);
  }

  const newToIds = new Map<string, string[]>();
  for (const [id, next] of idToNew) {
    const list = newToIds.get(next) ?? [];
    list.push(id);
    newToIds.set(next, list);
  }

  const conflicts: { email: string; userIds: string[] }[] = [];
  for (const [email, userIds] of newToIds) {
    if (userIds.length > 1) {
      conflicts.push({ email, userIds });
    }
  }

  if (conflicts.length > 0) {
    console.error(
      "Conflicts: multiple users normalize to the same email. Resolve manually before re-running:",
    );
    for (const c of conflicts) {
      console.error(JSON.stringify(c));
    }
    process.exit(1);
  }

  const updates = users.filter((u) => idToNew.get(u.id) !== u.email);
  if (updates.length === 0) {
    console.log("No user emails to update.");
    return;
  }

  console.log(`Updating ${updates.length} user row(s)...`);

  await prisma.$transaction(async (tx) => {
    for (const u of updates) {
      const next = idToNew.get(u.id)!;
      const oldEmail = u.email;
      await tx.verificationToken.updateMany({
        where: { identifier: oldEmail },
        data: { identifier: next },
      });
      await tx.user.update({
        where: { id: u.id },
        data: { email: next },
      });
    }
  });

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
