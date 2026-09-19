-- CreateEnum
CREATE TYPE "landing_theme_keyword_modes" AS ENUM ('APPEND', 'REPLACE');

-- AlterTable: hero_extra_keyword (single word) -> hero_keywords (comma-separated list)
-- + hero_keywords_mode (append to / replace the default rotation). Data-preserving:
-- add the new columns, copy over any existing single keyword, then drop the old column.
ALTER TABLE "landing_themes"
  ADD COLUMN "hero_keywords" TEXT,
  ADD COLUMN "hero_keywords_mode" "landing_theme_keyword_modes" NOT NULL DEFAULT 'APPEND';

UPDATE "landing_themes" SET "hero_keywords" = "hero_extra_keyword"
  WHERE "hero_extra_keyword" IS NOT NULL;

ALTER TABLE "landing_themes" DROP COLUMN "hero_extra_keyword";
