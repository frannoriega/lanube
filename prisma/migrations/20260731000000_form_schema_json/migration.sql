-- Move the form definition to a recursive JSON node tree (Form.schema), superseding the flat
-- form_fields table. This migration is additive: the column is nullable and form_fields is left
-- intact for the transition. See src/lib/events/form-schema.ts for the shape.

ALTER TABLE "forms" ADD COLUMN "schema" JSONB;

-- Backfill: build a flat schema (one "input" node per field, in order) for every form that has
-- fields. Field ids are reused verbatim as node ids so existing participant answers (keyed by
-- field id) keep resolving. `config` (reserved for per-field constraints) maps to `constraints`.
UPDATE "forms" f
SET "schema" = sub."schema"
FROM (
  SELECT
    ff."form_id",
    jsonb_build_object(
      'version', 1,
      'nodes', jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'kind', 'input',
            'id', ff."id",
            'type', ff."type"::text,
            'label', ff."label",
            'placeholder', ff."placeholder",
            'required', ff."required",
            'options', ff."options",
            'constraints', ff."config"
          )
        )
        ORDER BY ff."order"
      )
    ) AS "schema"
  FROM "form_fields" ff
  GROUP BY ff."form_id"
) sub
WHERE f."id" = sub."form_id";

-- Forms with no fields (or none created yet) get an empty schema rather than NULL.
UPDATE "forms"
SET "schema" = jsonb_build_object('version', 1, 'nodes', '[]'::jsonb)
WHERE "schema" IS NULL;
