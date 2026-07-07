-- Reservation types (Reunión, Taller, …) move from the `event_types` Postgres enum to a
-- catalog table so superadmins can manage them (create/rename/delete) at runtime. The
-- `code` stays the app-facing identifier (existing enum values keep working); `name` is
-- the display name shown in the UI.

-- 1) Catalog table, seeded from the enum's values.
CREATE TABLE "reservation_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
    "updated_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "reservation_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reservation_types_code_key" ON "reservation_types"("code");

CREATE TRIGGER set_updated_at_reservation_types
  BEFORE UPDATE ON "reservation_types"
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_ms();

INSERT INTO "reservation_types" ("id", "code", "name", "display_order") VALUES
  ('rt_meeting',    'MEETING',    'Reunión',     0),
  ('rt_workshop',   'WORKSHOP',   'Taller',      1),
  ('rt_conference', 'CONFERENCE', 'Conferencia', 2),
  ('rt_other',      'OTHER',      'Otro',        3);

-- 2) Enum columns become text FKs to the catalog's code. The ledger keeps a plain text
-- copy (derived data, rebuilt from reservations).
ALTER TABLE "events" ALTER COLUMN "event_type" TYPE TEXT USING "event_type"::text;
ALTER TABLE "reservations" ALTER COLUMN "event_type" TYPE TEXT USING "event_type"::text;
ALTER TABLE "reservation_ledger" ALTER COLUMN "event_type" TYPE TEXT USING "event_type"::text;

ALTER TABLE "events" ADD CONSTRAINT "events_event_type_fkey"
  FOREIGN KEY ("event_type") REFERENCES "reservation_types"("code")
  ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_event_type_fkey"
  FOREIGN KEY ("event_type") REFERENCES "reservation_types"("code")
  ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX "events_event_type_idx" ON "events"("event_type");
CREATE INDEX "reservations_event_type_idx" ON "reservations"("event_type");

-- 3) Functions whose signatures used the enum are recreated with text params
-- (bodies unchanged from 20260706000000_unify_space_resource).
DROP FUNCTION IF EXISTS insert_into_ledger(text,bigint,bigint,reservable_types,text,text,event_types,text,integer,reservation_statuses);
DROP FUNCTION IF EXISTS create_reservation(text,reservable_types,text,text,event_types,text,bigint,bigint,boolean,text,bigint);
DROP FUNCTION IF EXISTS create_event_reservation(text,text,text,event_types,text,bigint,bigint,boolean,text,bigint);
DROP FUNCTION IF EXISTS get_user_next_reservations(text,text,integer,integer);

CREATE OR REPLACE FUNCTION insert_into_ledger(
  _reservation_id text,
  _occurrence_start_ms bigint,
  _occurrence_end_ms bigint,
  _reservable_type reservable_types,
  _reservable_id text,
  _space_id text,
  _event_type text,
  _reason text,
  _actor_size int,
  _status reservation_statuses
)
RETURNS void AS $$
DECLARE
  bucket_ms bigint;
  step_ms bigint := 900000;
BEGIN
  IF _occurrence_end_ms <= _occurrence_start_ms THEN
    RETURN;
  END IF;

  FOR bucket_ms IN
    SELECT gs FROM generate_series(
      _occurrence_start_ms,
      _occurrence_end_ms - 1,
      step_ms
    ) AS gs
    WHERE gs < _occurrence_end_ms
  LOOP
    INSERT INTO reservation_ledger (
      id, reservation_id, occurrence_start_time, occurrence_end_time,
      reservable_type, reservable_id, space_id, event_type,
      reason, actor_size, status
    )
    VALUES (
      nextval('reservation_ledger_id_seq'), _reservation_id, bucket_ms, bucket_ms + step_ms,
      _reservable_type, _reservable_id, _space_id,
      _event_type, _reason, _actor_size, _status
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_reservation(
  _reservation_id text,
  _reservable_type reservable_types,
  _reservable_id text,
  _space_id text,
  _event_type text,
  _reason text,
  _start_ms bigint,
  _end_ms bigint,
  _is_recurring boolean DEFAULT false,
  _rrule text DEFAULT NULL,
  _recurrence_end_ms bigint DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  actor_size int;
  cap int;
  exclusive boolean;
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
  conflict_space_name text;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  duration_ms := _end_ms - _start_ms;
  IF duration_ms <= 0 THEN
    RAISE EXCEPTION 'Invalid reservation window';
  END IF;

  year_cap_ms := 365::bigint * 86400000;

  SELECT get_actor_size(_reservable_type, _reservable_id) INTO actor_size;

  SELECT capacity, is_exclusive
  INTO cap, exclusive
  FROM spaces
  WHERE id = _space_id;

  IF cap IS NULL THEN
    RAISE EXCEPTION 'No available resource for the given time window';
  END IF;

  IF NOT _is_recurring THEN
    IF exclusive THEN
      SELECT COUNT(*) INTO overlap
      FROM reservation_ledger l
      WHERE l.space_id = _space_id
        AND l.status = 'APPROVED'
        AND l.occurrence_start_time < _end_ms
        AND l.occurrence_end_time > _start_ms;

      IF overlap > 0 THEN
        RAISE EXCEPTION 'No available resource for the given time window';
      END IF;
    ELSE
      SELECT COALESCE(MAX(slot_sum), 0) INTO overlap
      FROM (
        SELECT COALESCE((
                 SELECT SUM(l.actor_size)
                 FROM reservation_ledger l
                 WHERE l.space_id = _space_id
                   AND l.status = 'APPROVED'
                   AND l.occurrence_start_time = gs
               ), 0) AS slot_sum
        FROM generate_series(_start_ms, _end_ms - 1, 900000::bigint) AS gs
        WHERE gs < _end_ms
      ) slot_check;

      IF (overlap + actor_size) > cap THEN
        RAISE EXCEPTION 'No available resource for the given time window';
      END IF;
    END IF;

    -- Cross-space overlap guard
    SELECT s.name
    INTO conflict_space_name
    FROM reservation_ledger l
    JOIN spaces s ON s.id = l.space_id
    WHERE l.reservable_id   = _reservable_id
      AND l.reservable_type = _reservable_type
      AND l.status          = 'APPROVED'
      AND l.space_id        <> _space_id
      AND l.occurrence_start_time < _end_ms
      AND l.occurrence_end_time   > _start_ms
    LIMIT 1;
    IF conflict_space_name IS NOT NULL THEN
      RAISE EXCEPTION 'Overlap with approved reservation at %', conflict_space_name;
    END IF;

    INSERT INTO reservations (
      id, reservable_type, reservable_id, space_id,
      event_type, reason, start_time, end_time,
      is_recurring, rrule, recurrence_end, status,
      created_at, updated_at
    )
    VALUES (
      _reservation_id, _reservable_type, _reservable_id, _space_id,
      _event_type, _reason, _start_ms, _end_ms,
      false, NULL, NULL, 'PENDING',
      now_ms, now_ms
    );

    PERFORM insert_into_ledger(_reservation_id, _start_ms, _end_ms, _reservable_type, _reservable_id, _space_id, _event_type, _reason, actor_size, 'PENDING');

    RETURN;
  END IF;

  -- Recurring path
  INSERT INTO reservations (
    id, reservable_type, reservable_id, space_id,
    event_type, reason, start_time, end_time,
    is_recurring, rrule, recurrence_end, status,
    created_at, updated_at
  )
  VALUES (
    _reservation_id, _reservable_type, _reservable_id, _space_id,
    _event_type, _reason, _start_ms, _end_ms,
    true, _rrule, _recurrence_end_ms, 'PENDING',
    now_ms, now_ms
  );

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
      IF exclusive THEN
        SELECT COUNT(*) INTO overlap
        FROM reservation_ledger l
        WHERE l.space_id = _space_id
          AND l.status = 'APPROVED'
          AND l.occurrence_start_time < win_e
          AND l.occurrence_end_time > win_s;

        IF overlap > 0 THEN
          RAISE EXCEPTION 'Conflict on %', occ_ms;
        END IF;
      ELSE
        SELECT COALESCE(MAX(slot_sum), 0) INTO overlap
        FROM (
          SELECT COALESCE((
                   SELECT SUM(l.actor_size)
                   FROM reservation_ledger l
                   WHERE l.space_id = _space_id
                     AND l.status = 'APPROVED'
                     AND l.occurrence_start_time = gs
                 ), 0) AS slot_sum
          FROM generate_series(win_s, win_e - 1, 900000::bigint) AS gs
          WHERE gs < win_e
        ) slot_check;

        IF (overlap + actor_size) > cap THEN
          RAISE EXCEPTION 'Capacity exceeded on %', occ_ms;
        END IF;
      END IF;

      -- Cross-space overlap guard per occurrence
      SELECT s.name
      INTO conflict_space_name
      FROM reservation_ledger l
      JOIN spaces s ON s.id = l.space_id
      WHERE l.reservable_id   = _reservable_id
        AND l.reservable_type = _reservable_type
        AND l.status          = 'APPROVED'
        AND l.space_id        <> _space_id
        AND l.occurrence_start_time < win_e
        AND l.occurrence_end_time   > win_s
      LIMIT 1;
      IF conflict_space_name IS NOT NULL THEN
        RAISE EXCEPTION 'Overlap with approved reservation at % on occurrence %', conflict_space_name, occ_ms;
      END IF;

      PERFORM insert_into_ledger(_reservation_id, win_s, win_e, _reservable_type, _reservable_id, _space_id, _event_type, _reason, actor_size, 'PENDING');
    END IF;

    EXIT WHEN occ_ms >= recurrence_cap_ms;
    occ_ms := (EXTRACT(EPOCH FROM (to_timestamp(occ_ms / 1000.0) + step_interval)) * 1000)::bigint;
    IF occ_ms <= _start_ms THEN
      EXIT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_event_reservation(
  _reservation_id text,
  _event_id text,
  _space_id text,
  _event_type text,
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

  SELECT capacity INTO cap FROM spaces WHERE id = _space_id;

  IF cap IS NULL THEN
    RAISE EXCEPTION 'Space % not found', _space_id;
  END IF;

  INSERT INTO reservations (
    id, reservable_type, reservable_id, space_id,
    event_type, reason, start_time, end_time,
    is_recurring, rrule, recurrence_end, status,
    created_at, updated_at
  )
  VALUES (
    _reservation_id, 'EVENT', _event_id, _space_id,
    _event_type, _reason, _start_ms, _end_ms,
    _is_recurring, _rrule, _recurrence_end_ms, 'APPROVED',
    now_ms, now_ms
  );

  IF NOT _is_recurring THEN
    SELECT COUNT(*) INTO overlap
    FROM reservation_ledger l
    WHERE l.space_id = _space_id
      AND l.status = 'APPROVED'
      AND l.occurrence_start_time < _end_ms
      AND l.occurrence_end_time > _start_ms;
    IF overlap > 0 THEN
      RAISE EXCEPTION 'Space % already booked for the given time window', _space_id;
    END IF;

    PERFORM insert_into_ledger(_reservation_id, _start_ms, _end_ms, 'EVENT', _event_id, _space_id, _event_type, _reason, cap, 'APPROVED');
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
      WHERE l.space_id = _space_id
        AND l.status = 'APPROVED'
        AND l.occurrence_start_time < win_e
        AND l.occurrence_end_time > win_s;
      IF overlap > 0 THEN
        RAISE EXCEPTION 'Space % already booked on occurrence %', _space_id, occ_ms;
      END IF;

      PERFORM insert_into_ledger(_reservation_id, win_s, win_e, 'EVENT', _event_id, _space_id, _event_type, _reason, cap, 'APPROVED');
    END IF;

    EXIT WHEN occ_ms >= recurrence_cap_ms;
    occ_ms := (EXTRACT(EPOCH FROM (to_timestamp(occ_ms / 1000.0) + step_interval)) * 1000)::bigint;
    IF occ_ms <= _start_ms THEN
      EXIT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_next_reservations(
  _user_id text,
  _space_id text DEFAULT NULL,
  _limit int DEFAULT 10,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id text,
  reservation_id text,
  occurrence_start_time bigint,
  occurrence_end_time bigint,
  reservable_type reservable_types,
  reservable_id text,
  space_id text,
  event_type text,
  reason text,
  actor_size int,
  status reservation_statuses,
  created_at bigint
) AS $$
DECLARE
  now_ms bigint;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;

  RETURN QUERY
  WITH expanded_reservations AS (
    SELECT
      r.id::text AS id,
      r.id::text AS reservation_id,
      r.start_time AS occurrence_start_time,
      r.end_time AS occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.space_id,
      r.event_type,
      r.reason,
      get_actor_size(r.reservable_type, r.reservable_id) AS actor_size,
      r.status,
      r.created_at
    FROM reservations r
    WHERE r.reservable_type = 'USER'
      AND (_space_id IS NULL OR r.space_id = _space_id)
      AND r.reservable_id = _user_id
      AND r.is_recurring = false
      AND r.start_time >= now_ms

    UNION ALL

    SELECT
      (r.id || '_' || eff.occ_eff_start::text) AS id,
      r.id::text AS reservation_id,
      eff.occ_eff_start AS occurrence_start_time,
      eff.occ_eff_end AS occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.space_id,
      r.event_type,
      r.reason,
      get_actor_size(r.reservable_type, r.reservable_id) AS actor_size,
      r.status,
      r.created_at
    FROM reservations r
    CROSS JOIN LATERAL generate_series(
      to_timestamp(r.start_time / 1000.0),
      LEAST(
        CASE
          WHEN r.recurrence_end IS NULL THEN to_timestamp(r.start_time / 1000.0) + interval '1 year'
          ELSE to_timestamp(r.recurrence_end / 1000.0)
        END,
        to_timestamp(r.start_time / 1000.0) + interval '1 year'
      ),
      CASE
        WHEN r.rrule ILIKE '%DAILY%' THEN interval '1 day'
        WHEN r.rrule ILIKE '%WEEKLY%' THEN interval '1 week'
        WHEN r.rrule ILIKE '%MONTHLY%' THEN interval '1 month'
        WHEN r.rrule ILIKE '%YEARLY%' THEN interval '1 year'
        ELSE interval '1 day'
      END
    ) AS occ_start
    LEFT JOIN LATERAL (
      SELECT re.is_cancelled, re.new_start_time, re.new_end_time
      FROM reservation_exceptions re
      WHERE re.reservation_id = r.id
        AND (to_timestamp(re.exception_date / 1000.0) AT TIME ZONE 'UTC')::date =
            (to_timestamp((EXTRACT(EPOCH FROM occ_start) * 1000)::bigint / 1000.0) AT TIME ZONE 'UTC')::date
      ORDER BY re.created_at DESC
      LIMIT 1
    ) ex ON true
    CROSS JOIN LATERAL (
      SELECT
        CASE
          WHEN ex.new_start_time IS NOT NULL AND ex.new_end_time IS NOT NULL
            THEN ex.new_start_time
          ELSE (EXTRACT(EPOCH FROM occ_start) * 1000)::bigint
        END AS occ_eff_start,
        CASE
          WHEN ex.new_start_time IS NOT NULL AND ex.new_end_time IS NOT NULL
            THEN ex.new_end_time
          ELSE (EXTRACT(EPOCH FROM occ_start) * 1000)::bigint + (r.end_time - r.start_time)
        END AS occ_eff_end
    ) eff
    WHERE r.reservable_type = 'USER'
      AND (_space_id IS NULL OR r.space_id = _space_id)
      AND r.reservable_id = _user_id
      AND r.is_recurring = true
      AND COALESCE(ex.is_cancelled, false) = false
      AND eff.occ_eff_start >= now_ms
      AND occ_start <= LEAST(
        CASE
          WHEN r.recurrence_end IS NULL THEN to_timestamp(r.start_time / 1000.0) + interval '1 year'
          ELSE to_timestamp(r.recurrence_end / 1000.0)
        END,
        to_timestamp(r.start_time / 1000.0) + interval '1 year'
      )
  )
  SELECT
    er.id,
    er.reservation_id,
    er.occurrence_start_time,
    er.occurrence_end_time,
    er.reservable_type,
    er.reservable_id,
    er.space_id,
    er.event_type,
    er.reason,
    er.actor_size,
    er.status,
    er.created_at
  FROM expanded_reservations er
  ORDER BY er.occurrence_start_time ASC
  LIMIT _limit
  OFFSET _offset;
END;
$$ LANGUAGE plpgsql;

-- 4) The enum is gone.
DROP TYPE "event_types";
