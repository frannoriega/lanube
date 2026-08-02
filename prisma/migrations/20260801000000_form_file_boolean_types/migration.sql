-- FILE (participant file uploads) and BOOLEAN (acknowledgement checkbox, e.g. terms & conditions)
-- field types. The form definition lives in Form.schema (JSON), where a type is just a string, but
-- form_fields.type is still dual-written during the transition, so the enum must accept them too.
ALTER TYPE "form_field_types" ADD VALUE IF NOT EXISTS 'FILE';
ALTER TYPE "form_field_types" ADD VALUE IF NOT EXISTS 'BOOLEAN';
