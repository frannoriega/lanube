-- New scalar field types for forms. The form definition now lives in Form.schema (JSON), where a
-- field type is just a string, but the legacy form_fields.type enum is still dual-written during
-- the transition, so it must accept the new values too.
ALTER TYPE "form_field_types" ADD VALUE IF NOT EXISTS 'INTEGER';
ALTER TYPE "form_field_types" ADD VALUE IF NOT EXISTS 'FLOAT';
ALTER TYPE "form_field_types" ADD VALUE IF NOT EXISTS 'MONEY';
