-- CreateEnum
CREATE TYPE "landing_theme_effects" AS ENUM ('NONE', 'EMOJI_SHOWER');

-- CreateTable
CREATE TABLE "landing_themes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "start_month_day" TEXT,
    "end_month_day" TEXT,
    "start_date" BIGINT,
    "end_date" BIGINT,
    "entrance_effect" "landing_theme_effects" NOT NULL DEFAULT 'NONE',
    "emoji_list" TEXT,
    "particle_count" INTEGER,
    "hero_eyebrow_override" TEXT,
    "hero_extra_keyword" TEXT,
    "accent_preset_key" TEXT,
    "banner_text" TEXT,
    "banner_url" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
    "updated_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "landing_themes_pkey" PRIMARY KEY ("id")
);
