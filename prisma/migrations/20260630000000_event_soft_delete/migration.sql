-- Soft delete for events: cancelled events keep their row (and participant history) but are
-- excluded from public surfaces and shown as "Cancelado" in admin.
ALTER TABLE "events" ADD COLUMN "deleted_at" BIGINT;
