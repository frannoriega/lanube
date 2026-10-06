-- ============================================================================
-- Milestone 22 — ventanas de mantenimiento (ver prisma/models/maintenance.prisma).
-- ============================================================================
CREATE TYPE "maintenance_modes" AS ENUM ('NOTICE', 'READ_ONLY', 'UNAVAILABLE');

CREATE TABLE "maintenance_windows" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason_md" TEXT NOT NULL,
    "mode" "maintenance_modes" NOT NULL,
    "areas" TEXT[],
    "starts_at" BIGINT,
    "ends_at" BIGINT,
    "ended_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
    "updated_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "maintenance_windows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "maintenance_windows_ended_at_idx" ON "maintenance_windows"("ended_at");
