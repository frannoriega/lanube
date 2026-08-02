-- Event card summary + featured flag/ordering.
ALTER TABLE "events" ADD COLUMN "summary" TEXT;
ALTER TABLE "events" ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "featured_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "events_is_featured_featured_order_idx" ON "events" ("is_featured", "featured_order");
