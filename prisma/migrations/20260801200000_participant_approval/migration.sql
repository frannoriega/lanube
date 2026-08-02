-- Participant approval workflow.
--
-- Events can require manual approval of registrations. Registrations gain a lifecycle status
-- replacing the old `cancelled` boolean: PENDING/APPROVED hold a spot (count toward capacity),
-- REJECTED/CANCELLED free it. Existing events are all effectively auto-approve, so existing
-- active rows (cancelled = false) map to APPROVED and cancelled rows map to CANCELLED.

-- Event opt-in flag.
ALTER TABLE "events"
  ADD COLUMN "requires_approval" BOOLEAN NOT NULL DEFAULT false;

-- Participant lifecycle enum.
CREATE TYPE "participant_statuses" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- Add the new columns (status defaults to APPROVED so the backfill only needs to touch cancelled rows).
ALTER TABLE "event_participants"
  ADD COLUMN "status" "participant_statuses" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "decision_reason" TEXT,
  ADD COLUMN "decided_at" BIGINT;

-- Backfill: previously-cancelled registrations become CANCELLED; the rest stay APPROVED.
UPDATE "event_participants" SET "status" = 'CANCELLED' WHERE "cancelled" = true;

-- Drop the old boolean.
ALTER TABLE "event_participants" DROP COLUMN "cancelled";

-- Fast lookups by (event, status) for the admin participants view + capacity counts.
CREATE INDEX "event_participants_event_id_status_idx" ON "event_participants" ("event_id", "status");
