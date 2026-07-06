-- ============================================================================
-- 0. Drop old function signatures that use resource_types (different param type
--    means CREATE OR REPLACE creates a new overload, leaving the old ones
--    behind and blocking DROP TYPE resource_types).
-- ============================================================================
DROP FUNCTION IF EXISTS create_reservation(text,reservable_types,text,resource_types,event_types,text,bigint,bigint,boolean,text,bigint);
DROP FUNCTION IF EXISTS get_unavailable_slots(resource_types,bigint,bigint,text);
DROP FUNCTION IF EXISTS get_user_next_reservations(text,resource_types,integer,integer);

-- ============================================================================
-- 1. Create spaces table
-- ============================================================================
CREATE TABLE spaces (
  id                  text        NOT NULL PRIMARY KEY,
  name                text        NOT NULL,
  slug                text        NOT NULL UNIQUE,
  description         text        NOT NULL,
  image_url           text,
  icon_name           text,
  is_reservable       boolean     NOT NULL DEFAULT false,
  is_featured         boolean     NOT NULL DEFAULT false,
  display_order       int         NOT NULL DEFAULT 0,
  metadata            jsonb,
  fungible_resource_id text       UNIQUE REFERENCES fungible_resources(id),
  created_at          bigint      NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
  updated_at          bigint      NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)
);

-- ============================================================================
-- 2. Rewrite create_reservation: _resource_type resource_types → _fungible_resource_id text
--    Latest version from 20260610000000_cross_resource_overlap_check, adapted.
-- ============================================================================
CREATE OR REPLACE FUNCTION create_reservation(
  _reservation_id text,
  _reservable_type reservable_types,
  _reservable_id text,
  _fungible_resource_id text,
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
  actor_size int;
  chosen_resource text;
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
  conflict_resource_name text;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  duration_ms := _end_ms - _start_ms;
  IF duration_ms <= 0 THEN
    RAISE EXCEPTION 'Invalid reservation window';
  END IF;

  year_cap_ms := 365::bigint * 86400000;

  SELECT get_actor_size(_reservable_type, _reservable_id)
  INTO actor_size;

  FOR chosen_resource, cap, exclusive IN
    SELECT
      r.id,
      COALESCE(fr.capacity, 1) AS capacity,
      COALESCE(fr.is_exclusive, true) AS is_exclusive
    FROM resources r
    LEFT JOIN fungible_resources fr ON fr.id = r.fungible_resource_id
    WHERE r.fungible_resource_id = _fungible_resource_id
    ORDER BY r.id
  LOOP
    IF exclusive THEN
      SELECT COUNT(*) INTO overlap
      FROM reservation_ledger l
      WHERE l.resource_id = chosen_resource
        AND l.status = 'APPROVED'
        AND l.occurrence_start_time < _end_ms
        AND l.occurrence_end_time > _start_ms;

      IF overlap = 0 THEN
        EXIT;
      END IF;

    ELSE
      SELECT COALESCE(MAX(slot_sum), 0)
        INTO overlap
      FROM (
        SELECT COALESCE((
                 SELECT SUM(l.actor_size)
                 FROM reservation_ledger l
                 WHERE l.resource_id = chosen_resource
                   AND l.status = 'APPROVED'
                   AND l.occurrence_start_time = gs
               ), 0) AS slot_sum
        FROM generate_series(_start_ms, _end_ms - 1, 900000::bigint) AS gs
        WHERE gs < _end_ms
      ) slot_check;

      IF (overlap + actor_size) <= cap THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF chosen_resource IS NULL THEN
    RAISE EXCEPTION 'No available resource for the given time window';
  END IF;

  IF NOT _is_recurring THEN
    -- Cross-resource overlap guard
    SELECT r.name
    INTO conflict_resource_name
    FROM reservation_ledger l
    JOIN resources r ON r.id = l.resource_id
    WHERE l.reservable_id   = _reservable_id
      AND l.reservable_type = _reservable_type
      AND l.status          = 'APPROVED'
      AND l.occurrence_start_time < _end_ms
      AND l.occurrence_end_time   > _start_ms
    LIMIT 1;
    IF conflict_resource_name IS NOT NULL THEN
      RAISE EXCEPTION 'Overlap with approved reservation at %', conflict_resource_name;
    END IF;

    INSERT INTO reservations (
      id, reservable_type, reservable_id, resource_id,
      event_type, reason, start_time, end_time,
      is_recurring, rrule, recurrence_end, status,
      created_at, updated_at
    )
    VALUES (
      _reservation_id, _reservable_type, _reservable_id, chosen_resource,
      _event_type, _reason, _start_ms, _end_ms,
      false, NULL, NULL, 'PENDING',
      now_ms, now_ms
    );

    PERFORM insert_into_ledger(_reservation_id, _start_ms, _end_ms, _reservable_type, _reservable_id, chosen_resource, _event_type, _reason, actor_size, 'PENDING');

    RETURN;
  END IF;

  INSERT INTO reservations (
    id, reservable_type, reservable_id, resource_id,
    event_type, reason, start_time, end_time,
    is_recurring, rrule, recurrence_end, status,
    created_at, updated_at
  )
  VALUES (
    _reservation_id, _reservable_type, _reservable_id, chosen_resource,
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
        WHERE l.resource_id = chosen_resource
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
                   WHERE l.resource_id = chosen_resource
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

      -- Cross-resource overlap guard per occurrence
      SELECT r.name
      INTO conflict_resource_name
      FROM reservation_ledger l
      JOIN resources r ON r.id = l.resource_id
      WHERE l.reservable_id   = _reservable_id
        AND l.reservable_type = _reservable_type
        AND l.status          = 'APPROVED'
        AND l.occurrence_start_time < win_e
        AND l.occurrence_end_time   > win_s
      LIMIT 1;
      IF conflict_resource_name IS NOT NULL THEN
        RAISE EXCEPTION 'Overlap with approved reservation at % on occurrence %', conflict_resource_name, occ_ms;
      END IF;

      PERFORM insert_into_ledger(_reservation_id, win_s, win_e, _reservable_type, _reservable_id, chosen_resource, _event_type, _reason, actor_size, 'PENDING');
    END IF;

    EXIT WHEN occ_ms >= recurrence_cap_ms;
    occ_ms := (EXTRACT(EPOCH FROM (to_timestamp(occ_ms / 1000.0) + step_interval)) * 1000)::bigint;
    IF occ_ms <= _start_ms THEN
      EXIT;
    END IF;
  END LOOP;

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Rewrite get_unavailable_slots: _resource_type → _fungible_resource_id
--    Latest version from 20260404180000_unix_timestamps_ms, adapted.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_unavailable_slots(
  _fungible_resource_id text,
  _from_ms bigint,
  _to_ms bigint,
  _exclude_user_id text DEFAULT NULL
)
RETURNS TABLE (
  resource_id text,
  start_time bigint,
  end_time bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH ledger_data AS (
    SELECT
      r.id AS resource_id,
      COALESCE(fr.capacity, 1) AS capacity,
      COALESCE(fr.is_exclusive, true) AS is_exclusive,
      l.occurrence_start_time,
      l.occurrence_end_time,
      SUM(l.actor_size) OVER (
        PARTITION BY r.id
        ORDER BY l.occurrence_start_time
        RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
      ) AS total_used
    FROM reservation_ledger l
    JOIN resources r ON r.id = l.resource_id
    LEFT JOIN fungible_resources fr ON fr.id = r.fungible_resource_id
    WHERE r.fungible_resource_id = _fungible_resource_id
      AND l.status = 'APPROVED'
      AND l.occurrence_start_time < _to_ms
      AND l.occurrence_end_time > _from_ms
      AND (_exclude_user_id IS NULL OR l.reservable_id != _exclude_user_id)
  )
  SELECT DISTINCT
    l.resource_id,
    occurrence_start_time AS start_time,
    occurrence_end_time AS end_time
  FROM ledger_data l
  WHERE
    (is_exclusive = true)
    OR (total_used >= capacity)
  ORDER BY start_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Rewrite get_user_next_reservations: _resource_type → _fungible_resource_id
--    Latest version from 20260406200000_reservation_ledger_maintenance, adapted.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_next_reservations(
  _user_id text,
  _fungible_resource_id text DEFAULT NULL,
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
  resource_id text,
  event_type event_types,
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
      r.resource_id,
      r.event_type,
      r.reason,
      get_actor_size(r.reservable_type, r.reservable_id) AS actor_size,
      r.status,
      r.created_at
    FROM reservations r
    JOIN resources res ON res.id = r.resource_id
    WHERE r.reservable_type = 'USER'
      AND (_fungible_resource_id IS NULL OR res.fungible_resource_id = _fungible_resource_id)
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
      r.resource_id,
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
    JOIN resources res ON res.id = r.resource_id
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
      AND (_fungible_resource_id IS NULL OR res.fungible_resource_id = _fungible_resource_id)
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
    er.resource_id,
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

-- ============================================================================
-- 5. Drop type column from resources and the enum
-- ============================================================================
ALTER TABLE resources DROP COLUMN IF EXISTS type;
DROP TYPE IF EXISTS resource_types;
