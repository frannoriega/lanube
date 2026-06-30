-- Event lifecycle status. ENDED is derived (last occurrence in the past), not stored.
CREATE TYPE "event_statuses" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED');

ALTER TABLE "events"
  ADD COLUMN "status" "event_statuses" NOT NULL DEFAULT 'DRAFT';

-- Backfill: events whose form was already published become PUBLISHED so existing public
-- links keep working after the switch to status-driven availability.
UPDATE "events" e
SET "status" = 'PUBLISHED'
FROM "event_forms" ef
WHERE ef."event_id" = e."id" AND ef."is_published" = true;
