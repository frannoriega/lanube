import 'server-only'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { authTimestampBridgeExtension } from '@/lib/prisma-auth-bridge'

const globalForPrisma = global as unknown as {
  prisma: PrismaClient
  pool: Pool
}

const pool =
  globalForPrisma.pool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
  })

const adapter = new PrismaPg(pool)

const prisma =
  globalForPrisma.prisma ||
  (new PrismaClient({ adapter }).$extends(
    authTimestampBridgeExtension,
  ) as unknown as PrismaClient)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.pool = pool
  globalForPrisma.prisma = prisma
}

export { prisma }
