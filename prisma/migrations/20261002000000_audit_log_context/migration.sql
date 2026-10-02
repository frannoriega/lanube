-- Identifying info about the record an audit entry acted on, independent of the before/after
-- diff (which only ever holds changed fields). See the doc comment on AuditLog.context in
-- prisma/models/audit.prisma.
ALTER TABLE "audit_logs" ADD COLUMN "context" JSONB;
