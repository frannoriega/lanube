-- ============================================================================
-- Milestone 12 follow-up — a PUBLISHED Noticia never changes/leaves the site
-- on a plain author's say-so.
--
-- Replaces the D20 "amend in place + needs_review" mechanism (a plain author's
-- edit to a live post applied instantly, flagged for a later look) with a
-- request/decision cycle: a `news:manage`-only author proposes an EDIT (staged
-- in the pending_* snapshot columns, live fields untouched), a PAUSE, or a
-- DELETE against their own PUBLISHED post, and an Admin/Superadmin
-- (`news:approve`) approves or rejects it through the same decision endpoint
-- already used for PENDING_REVIEW. Admin/Superadmin are unaffected — they can
-- still edit/pause/delete a PUBLISHED post directly.
-- ============================================================================

DROP INDEX "news_posts_needs_review_idx";

ALTER TABLE "news_posts" DROP COLUMN "needs_review";

-- CreateEnum
CREATE TYPE "news_pending_actions" AS ENUM ('EDIT', 'PAUSE', 'DELETE');

ALTER TABLE "news_posts"
  ADD COLUMN "pending_action" "news_pending_actions",
  ADD COLUMN "pending_title" TEXT,
  ADD COLUMN "pending_slug" TEXT,
  ADD COLUMN "pending_summary" TEXT,
  ADD COLUMN "pending_body" TEXT,
  ADD COLUMN "pending_cover_image_url" TEXT,
  ADD COLUMN "pending_reason" TEXT,
  ADD COLUMN "pending_requested_at" BIGINT,
  ADD COLUMN "deleted_at" BIGINT;

CREATE INDEX "news_posts_pending_action_idx" ON "news_posts" ("pending_action");
