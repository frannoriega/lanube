-- Events & custom forms feature.
--
-- 1. Make reservations.reservable_id genuinely polymorphic by dropping its FK to
--    registered_users. The reservable_types enum already includes EVENT/ORGANIZATION/TEAM;
--    an EVENT reservation points reservable_id at an events.id row, which the old FK
--    forbade. The Prisma schema still declares the Reservation.registeredUser relation
--    (Prisma joins on the column regardless of a DB FK; it simply yields NULL for non-USER
--    rows). NOTE: a plain `prisma migrate dev` may propose re-adding this constraint — that
--    proposal must be discarded; this hand-written migration is the source of truth.
-- 2. Extend events into bookable workshops/classes and add the form builder + participant
--    tables.
-- 3. create_event_reservation(): like create_reservation() but targets a specific resource,
--    is APPROVED on creation, and fully blocks the resource for each occurrence.

-- ============================================================================
-- 1. Drop the reservable_id -> registered_users FK (polymorphic reservable_id)
-- ============================================================================
ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_reservable_id_fkey";

-- ============================================================================
-- 2. Schema: events extension + form builder + participants
-- ============================================================================

-- Replaced by event_participants (keyed by normalized email, not user id).
DROP TABLE IF EXISTS "user_events";

CREATE TYPE "form_field_types" AS ENUM (
  'SHORT_TEXT', 'LONG_TEXT', 'NUMBER', 'SINGLE_SELECT', 'MULTI_SELECT',
  'DATE', 'TIME', 'PHONE', 'DNI'
);

ALTER TABLE "events"
  ADD COLUMN "event_type" "event_types" NOT NULL DEFAULT 'WORKSHOP',
  ADD COLUMN "resource_id" TEXT,
  ADD COLUMN "rrule" TEXT,
  ADD COLUMN "recurrence_end" BIGINT,
  ADD COLUMN "capacity" INTEGER;
-- Drop the temporary default now that existing (zero) rows are covered.
ALTER TABLE "events" ALTER COLUMN "event_type" DROP DEFAULT;

CREATE INDEX "events_resource_id_idx" ON "events"("resource_id");

ALTER TABLE "events"
  ADD CONSTRAINT "events_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "resources"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- forms: holds the form structure. A form is either a reusable template
-- (is_template = true, lives in the admin Forms section) or a per-event instance
-- (is_template = false) cloned from a template when an event binds it.
CREATE TABLE "forms" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_template" BOOLEAN NOT NULL DEFAULT true,
  "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
  "updated_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

  CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- event_forms: binds a cloned form instance to an event, carrying the registration
-- window and publish state. One per event; one instance form per binding.
CREATE TABLE "event_forms" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "form_id" TEXT NOT NULL,
  "template_id" TEXT,
  "slug" TEXT NOT NULL,
  "opens_at" BIGINT NOT NULL,
  "closes_at" BIGINT NOT NULL,
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
  "updated_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

  CONSTRAINT "event_forms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "event_forms_event_id_key" ON "event_forms"("event_id");
CREATE UNIQUE INDEX "event_forms_form_id_key" ON "event_forms"("form_id");
CREATE UNIQUE INDEX "event_forms_slug_key" ON "event_forms"("slug");
ALTER TABLE "event_forms"
  ADD CONSTRAINT "event_forms_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_forms"
  ADD CONSTRAINT "event_forms_form_id_fkey"
  FOREIGN KEY ("form_id") REFERENCES "forms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- form_fields belong to a form (template or instance).
CREATE TABLE "form_fields" (
  "id" TEXT NOT NULL,
  "form_id" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "type" "form_field_types" NOT NULL,
  "label" TEXT NOT NULL,
  "placeholder" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "config" JSONB,

  CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "form_fields_form_id_idx" ON "form_fields"("form_id");
ALTER TABLE "form_fields"
  ADD CONSTRAINT "form_fields_form_id_fkey"
  FOREIGN KEY ("form_id") REFERENCES "forms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- event_participants (keyed by normalized email per event)
CREATE TABLE "event_participants" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "display_email" TEXT,
  "user_id" TEXT,
  "edit_token" TEXT NOT NULL,
  "cancelled" BOOLEAN NOT NULL DEFAULT false,
  "answers" JSONB NOT NULL,
  "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
  "updated_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

  CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "event_participants_edit_token_key" ON "event_participants"("edit_token");
CREATE UNIQUE INDEX "event_participants_event_id_email_key" ON "event_participants"("event_id", "email");
CREATE INDEX "event_participants_email_idx" ON "event_participants"("email");
CREATE INDEX "event_participants_user_id_idx" ON "event_participants"("user_id");
ALTER TABLE "event_participants"
  ADD CONSTRAINT "event_participants_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_participants"
  ADD CONSTRAINT "event_participants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "registered_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep updated_at fresh on events' new sibling tables (mirrors set_events_updated_at).
DROP TRIGGER IF EXISTS set_forms_updated_at ON forms;
CREATE TRIGGER set_forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_event_forms_updated_at ON event_forms;
CREATE TRIGGER set_event_forms_updated_at
  BEFORE UPDATE ON event_forms
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

DROP TRIGGER IF EXISTS set_event_participants_updated_at ON event_participants;
CREATE TRIGGER set_event_participants_updated_at
  BEFORE UPDATE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

-- ============================================================================
-- 3. get_actor_size(): an EVENT occupies its resource's full capacity, so the value
--    survives ledger rebuilds (rebuild_reservation_ledger_forward + maintenance cron).
-- ============================================================================
CREATE OR REPLACE FUNCTION get_actor_size(_type reservable_types, _id text)
RETURNS int AS $$
DECLARE
  size int := 1;
BEGIN
  IF _type = 'USER' THEN
    RETURN 1;
  ELSIF _type = 'TEAM' THEN
    SELECT COUNT(*) INTO size FROM team_members WHERE team_id = _id;
  ELSIF _type = 'ORGANIZATION' THEN
    SELECT COUNT(*) INTO size FROM org_memberships WHERE organization_id = _id;
  ELSIF _type = 'EVENT' THEN
    SELECT COALESCE(fr.capacity, 1) INTO size
    FROM events e
    JOIN resources r ON r.id = e.resource_id
    LEFT JOIN fungible_resources fr ON fr.id = r.fungible_resource_id
    WHERE e.id = _id;
  ELSE
    size := 1;
  END IF;

  RETURN COALESCE(size, 1);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. create_event_reservation(): specific resource, APPROVED, fully blocks the resource
-- ============================================================================
CREATE OR REPLACE FUNCTION create_event_reservation(
  _reservation_id text,
  _event_id text,
  _resource_id text,
  _event_type event_types,
  _reason text,
  _start_ms bigint,
  _end_ms bigint,
  _is_recurring boolean DEFAULT false,
  _rrule text DEFAULT NULL,
  _recurrence_end_ms bigint DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  cap int;
  overlap int;
  occ_ms bigint;
  duration_ms bigint;
  recurrence_cap_ms bigint;
  year_cap_ms bigint;
  step_interval interval;
  now_ms bigint;
  omit boolean;
  win_s bigint;
  win_e bigint;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  duration_ms := _end_ms - _start_ms;
  IF duration_ms <= 0 THEN
    RAISE EXCEPTION 'Invalid reservation window';
  END IF;

  year_cap_ms := 365::bigint * 86400000;

  -- The event occupies the whole resource: actor_size = resource capacity, so any
  -- overlapping APPROVED reservation (event or user) conflicts.
  SELECT COALESCE(fr.capacity, 1)
  INTO cap
  FROM resources r
  LEFT JOIN fungible_resources fr ON fr.id = r.fungible_resource_id
  WHERE r.id = _resource_id;

  IF cap IS NULL THEN
    RAISE EXCEPTION 'Resource % not found', _resource_id;
  END IF;

  INSERT INTO reservations (
    id, reservable_type, reservable_id, resource_id,
    event_type, reason, start_time, end_time,
    is_recurring, rrule, recurrence_end, status,
    created_at, updated_at
  )
  VALUES (
    _reservation_id, 'EVENT', _event_id, _resource_id,
    _event_type, _reason, _start_ms, _end_ms,
    _is_recurring, _rrule, _recurrence_end_ms, 'APPROVED',
    now_ms, now_ms
  );

  IF NOT _is_recurring THEN
    SELECT COUNT(*) INTO overlap
    FROM reservation_ledger l
    WHERE l.resource_id = _resource_id
      AND l.status = 'APPROVED'
      AND l.occurrence_start_time < _end_ms
      AND l.occurrence_end_time > _start_ms;
    IF overlap > 0 THEN
      RAISE EXCEPTION 'Resource % already booked for the given time window', _resource_id;
    END IF;

    PERFORM insert_into_ledger(_reservation_id, _start_ms, _end_ms, 'EVENT', _event_id, _resource_id, _event_type, _reason, cap, 'APPROVED');
    RETURN;
  END IF;

  IF _rrule ILIKE '%DAILY%' THEN
    step_interval := interval '1 day';
  ELSIF _rrule ILIKE '%WEEKLY%' THEN
    step_interval := interval '1 week';
  ELSIF _rrule ILIKE '%MONTHLY%' THEN
    step_interval := interval '1 month';
  ELSIF _rrule ILIKE '%YEARLY%' THEN
    step_interval := interval '1 year';
  ELSE
    step_interval := interval '1 day';
  END IF;

  recurrence_cap_ms := LEAST(
    COALESCE(_recurrence_end_ms, _start_ms + year_cap_ms),
    _start_ms + year_cap_ms
  );

  occ_ms := _start_ms;
  WHILE occ_ms <= recurrence_cap_ms LOOP
    SELECT * INTO omit, win_s, win_e
    FROM effective_occurrence_window(_reservation_id, occ_ms, duration_ms);

    IF NOT omit THEN
      SELECT COUNT(*) INTO overlap
      FROM reservation_ledger l
      WHERE l.resource_id = _resource_id
        AND l.status = 'APPROVED'
        AND l.occurrence_start_time < win_e
        AND l.occurrence_end_time > win_s;
      IF overlap > 0 THEN
        RAISE EXCEPTION 'Resource % already booked on occurrence %', _resource_id, occ_ms;
      END IF;

      PERFORM insert_into_ledger(_reservation_id, win_s, win_e, 'EVENT', _event_id, _resource_id, _event_type, _reason, cap, 'APPROVED');
    END IF;

    EXIT WHEN occ_ms >= recurrence_cap_ms;
    occ_ms := (EXTRACT(EPOCH FROM (to_timestamp(occ_ms / 1000.0) + step_interval)) * 1000)::bigint;
    IF occ_ms <= _start_ms THEN
      EXIT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
