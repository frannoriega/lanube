-- AlterTable
ALTER TABLE "bans" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "check_ins" ALTER COLUMN "check_in_time" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "fungible_resources" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "incidents" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "inventories" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "createdAt" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "proposal_comments" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "proposals" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "purchase_orders" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "rate_limits" ALTER COLUMN "windowStart" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "createdAt" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updatedAt" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "registered_users" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "reservation_exceptions" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "reservation_ledger" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "reservations" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "resources" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);

-- AlterTable
ALTER TABLE "teams" ALTER COLUMN "created_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
ALTER COLUMN "updated_at" SET DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint);
