import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  const sql = readFileSync(
    join(__dirname, 'prisma/migrations/20251012223516_fix_expand_recurring_reservations_timestamp/migration.sql'),
    'utf-8'
  );

  console.log('Applying migration fix...');
  await prisma.$executeRawUnsafe(sql);
  console.log('✅ Migration applied successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error applying migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

