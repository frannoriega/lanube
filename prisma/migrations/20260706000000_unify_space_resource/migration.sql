-- ============================================================================
-- Unify Space + FungibleResource + Resource (space side)
--
-- Space becomes the single reservable entity for rooms/areas.
-- FungibleResource is dropped; its capacity/is_exclusive move into Space.
-- reservations, reservation_ledger, and events all switch resource_id → space_id.
-- Resource stays as standalone equipment tracking (no FK to spaces).
-- ============================================================================

-- 1. Add reservation fields to spaces
ALTER TABLE spaces ADD COLUMN capacity int NOT NULL DEFAULT 1;
ALTER TABLE spaces ADD COLUMN is_exclusive boolean NOT NULL DEFAULT false;

-- Copy capacity + is_exclusive from fungible_resources via the existing FK
UPDATE spaces s
SET capacity = fr.capacity,
    is_exclusive = fr.is_exclusive
FROM fungible_resources fr
WHERE s.fungible_resource_id = fr.id;

-- 2. Drop the FK link from spaces to fungible_resources
ALTER TABLE spaces DROP COLUMN fungible_resource_id;

-- 3. Add space_id to reservations and data-migrate from resource → space
ALTER TABLE reservations ADD COLUMN space_id text;

UPDATE reservations r
SET space_id = s.id
FROM resources res
JOIN spaces s ON s.id = (
  SELECT sp.id FROM spaces sp
  JOIN fungible_resources fr ON fr.id = res.fungible_resource_id
  WHERE sp.id = (
    SELECT sp2.id FROM spaces sp2
    WHERE sp2.capacity = fr.capacity
      AND sp2.is_exclusive = fr.is_exclusive
      AND sp2.name = fr.name
    LIMIT 1
  )
  LIMIT 1
)
WHERE res.id = r.resource_id;

-- Simpler: join resources → (the spaces table now has capacity/is_exclusive copied,
-- but we lost the fungible_resource_id FK). Re-derive via resource name match.
-- Since every resource had the same name as its fungible_resource and its space,
-- match by name directly:
UPDATE reservations r
SET space_id = s.id
FROM resources res
JOIN spaces s ON s.name = res.name
WHERE res.id = r.resource_id
  AND r.space_id IS NULL;

-- 4. Drop old resource_id FK + column from reservations
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_resource_id_fkey;
ALTER TABLE reservations DROP COLUMN resource_id;

-- Add FK for space_id (nullable to match prior onDelete: SetNull behaviour)
ALTER TABLE reservations
  ADD CONSTRAINT reservations_space_id_fkey
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL;

-- 5. reservation_ledger: rename resource_id → space_id
ALTER TABLE reservation_ledger ADD COLUMN space_id text;

UPDATE reservation_ledger l
SET space_id = s.id
FROM resources res
JOIN spaces s ON s.name = res.name
WHERE res.id = l.resource_id;

ALTER TABLE reservation_ledger DROP COLUMN resource_id;

-- 6. events: rename resource_id → space_id
ALTER TABLE events ADD COLUMN space_id text;

UPDATE events e
SET space_id = s.id
FROM resources res
JOIN spaces s ON s.name = res.name
WHERE res.id = e.resource_id;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_resource_id_fkey;
ALTER TABLE events DROP COLUMN resource_id;

ALTER TABLE events
  ADD CONSTRAINT events_space_id_fkey
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;

ALTER TABLE events ALTER COLUMN space_id SET NOT NULL;

-- 7. resources: drop fungible_resource_id (now standalone equipment tracking)
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_fungible_resource_id_fkey;
ALTER TABLE resources DROP COLUMN IF EXISTS fungible_resource_id;

-- 8. Drop fungible_resources table
DROP TABLE IF EXISTS fungible_resources;

-- ============================================================================
-- 9. Drop all functions before recreating (parameter renames require DROP first)
-- ============================================================================
DROP FUNCTION IF EXISTS insert_into_ledger(text,bigint,bigint,reservable_types,text,text,event_types,text,integer,reservation_statuses);
DROP FUNCTION IF EXISTS create_reservation(text,reservable_types,text,text,event_types,text,bigint,bigint,boolean,text,bigint);
DROP FUNCTION IF EXISTS create_event_reservation(text,text,text,event_types,text,bigint,bigint,boolean,text,bigint);
DROP FUNCTION IF EXISTS approve_reservation(text);
DROP FUNCTION IF EXISTS get_unavailable_slots(text,bigint,bigint,text);
DROP FUNCTION IF EXISTS get_user_next_reservations(text,text,integer,integer);
DROP FUNCTION IF EXISTS rebuild_reservation_ledger_forward(text);
DROP FUNCTION IF EXISTS reservation_window_conflicts(text,bigint,bigint);
DROP FUNCTION IF EXISTS maintain_reservations();

-- ============================================================================
-- Rewrite insert_into_ledger: _resource_id → _space_id
-- ============================================================================
CREATE OR REPLACE FUNCTION insert_into_ledger(
  _reservation_id text,
  _occurrence_start_ms bigint,
  _occurrence_end_ms bigint,
  _reservable_type reservable_types,
  _reservable_id text,
  _space_id text,
  _event_type event_types,
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

-- ============================================================================
-- 10. Rewrite create_reservation: _fungible_resource_id → _space_id
--     No more resource picking — Space is the direct reservable entity.
-- ============================================================================
CREATE OR REPLACE FUNCTION create_reservation(
  _reservation_id text,
  _reservable_type reservable_types,
  _reservable_id text,
  _space_id text,
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

-- ============================================================================
-- 11. Rewrite create_event_reservation: _resource_id → _space_id
-- ============================================================================
CREATE OR REPLACE FUNCTION create_event_reservation(
  _reservation_id text,
  _event_id text,
  _space_id text,
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

-- ============================================================================
-- 12. Rewrite approve_reservation: resource_id → space_id, drop fungible join
-- ============================================================================
CREATE OR REPLACE FUNCTION approve_reservation(_reservation_id text)
RETURNS TABLE(approved_id text, auto_rejected_ids text) AS $$
DECLARE
  res RECORD;
  cap int;
  exclusive boolean;
  used int;
  overlap RECORD;
  rejected_ids text[];
  now_ms bigint;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  rejected_ids := ARRAY[]::text[];

  SELECT r.id AS reservation_id,
         r.space_id,
         r.reservable_id,
         r.reservable_type,
         r.start_time,
         r.end_time,
         s.capacity,
         s.is_exclusive
  INTO res
  FROM reservations r
  JOIN spaces s ON s.id = r.space_id
  WHERE r.id = _reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation % not found', _reservation_id;
  END IF;

  cap := res.capacity;
  exclusive := res.is_exclusive;

  UPDATE reservations
    SET status = 'APPROVED', updated_at = now_ms
    WHERE id = _reservation_id;

  UPDATE reservation_ledger
    SET status = 'APPROVED'
    WHERE reservation_id = _reservation_id;

  -- Auto-reject conflicting PENDING reservations on the same space
  FOR overlap IN
    SELECT DISTINCT rl.reservation_id
    FROM reservation_ledger rl
    WHERE rl.space_id = res.space_id
      AND rl.status = 'PENDING'
      AND rl.reservation_id <> _reservation_id
      AND EXISTS (
        SELECT 1
        FROM reservation_ledger a
        WHERE a.reservation_id = _reservation_id
          AND a.space_id = res.space_id
          AND a.status = 'APPROVED'
          AND rl.occurrence_start_time < a.occurrence_end_time
          AND rl.occurrence_end_time > a.occurrence_start_time
      )
  LOOP
    IF exclusive THEN
      UPDATE reservations SET status = 'REJECTED', updated_at = now_ms
        WHERE id = overlap.reservation_id;
      UPDATE reservation_ledger SET status = 'REJECTED'
        WHERE reservation_id = overlap.reservation_id;
      rejected_ids := array_append(rejected_ids, overlap.reservation_id);
    ELSE
      SELECT COALESCE(MAX(approved_at_slot + p_actor_size), 0)
      INTO used
      FROM (
        SELECT p.occurrence_start_time,
               p.actor_size AS p_actor_size,
               COALESCE((
                 SELECT SUM(a.actor_size)
                 FROM reservation_ledger a
                 WHERE a.space_id = res.space_id
                   AND a.status = 'APPROVED'
                   AND a.occurrence_start_time = p.occurrence_start_time
               ), 0) AS approved_at_slot
        FROM reservation_ledger p
        WHERE p.reservation_id = overlap.reservation_id
          AND p.status = 'PENDING'
          AND EXISTS (
            SELECT 1
            FROM reservation_ledger a
            WHERE a.reservation_id = _reservation_id
              AND a.status = 'APPROVED'
              AND a.space_id = res.space_id
              AND p.occurrence_start_time < a.occurrence_end_time
              AND p.occurrence_end_time > a.occurrence_start_time
          )
      ) slot_check;

      IF used > cap THEN
        UPDATE reservations
          SET status = 'REJECTED', updated_at = now_ms
          WHERE id = overlap.reservation_id;
        UPDATE reservation_ledger
          SET status = 'REJECTED'
          WHERE reservation_id = overlap.reservation_id;
        rejected_ids := array_append(rejected_ids, overlap.reservation_id);
      END IF;
    END IF;
  END LOOP;

  -- Auto-reject PENDING reservations of the same reservable on a different space
  -- that overlap the just-approved reservation (cross-space conflict enforcement).
  FOR overlap IN
    SELECT DISTINCT rl.reservation_id
    FROM reservation_ledger rl
    WHERE rl.reservable_id   = res.reservable_id
      AND rl.reservable_type = res.reservable_type
      AND rl.status          = 'PENDING'
      AND rl.reservation_id <> _reservation_id
      AND rl.space_id        <> res.space_id
      AND EXISTS (
        SELECT 1
        FROM reservation_ledger a
        WHERE a.reservation_id = _reservation_id
          AND a.status         = 'APPROVED'
          AND rl.occurrence_start_time < a.occurrence_end_time
          AND rl.occurrence_end_time   > a.occurrence_start_time
      )
  LOOP
    UPDATE reservations SET status = 'REJECTED', updated_at = now_ms
      WHERE id = overlap.reservation_id;
    UPDATE reservation_ledger SET status = 'REJECTED'
      WHERE reservation_id = overlap.reservation_id;
    rejected_ids := array_append(rejected_ids, overlap.reservation_id);
  END LOOP;

  RETURN QUERY SELECT _reservation_id, array_to_string(rejected_ids, ',');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 13. Rewrite get_unavailable_slots: _fungible_resource_id → _space_id
-- ============================================================================
CREATE OR REPLACE FUNCTION get_unavailable_slots(
  _space_id text,
  _from_ms bigint,
  _to_ms bigint,
  _exclude_user_id text DEFAULT NULL
)
RETURNS TABLE (
  space_id text,
  start_time bigint,
  end_time bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH ledger_data AS (
    SELECT
      l.space_id,
      s.capacity,
      s.is_exclusive,
      l.occurrence_start_time,
      l.occurrence_end_time,
      SUM(l.actor_size) OVER (
        PARTITION BY l.space_id
        ORDER BY l.occurrence_start_time
        RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
      ) AS total_used
    FROM reservation_ledger l
    JOIN spaces s ON s.id = l.space_id
    WHERE l.space_id = _space_id
      AND l.status = 'APPROVED'
      AND l.occurrence_start_time < _to_ms
      AND l.occurrence_end_time > _from_ms
      AND (_exclude_user_id IS NULL OR l.reservable_id != _exclude_user_id)
  )
  SELECT DISTINCT
    l.space_id,
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
-- 14. Rewrite get_user_next_reservations: _fungible_resource_id → _space_id
-- ============================================================================
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

-- ============================================================================
-- 15. Rewrite rebuild_reservation_ledger_forward: resource_id → space_id
-- ============================================================================
CREATE OR REPLACE FUNCTION rebuild_reservation_ledger_forward(_reservation_id text)
RETURNS void AS $$
DECLARE
  r RECORD;
  actor_size int;
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
  year_cap_ms := 365::bigint * 86400000;

  SELECT * INTO r FROM reservations WHERE id = _reservation_id;
  IF NOT FOUND OR NOT r.is_recurring OR r.rrule IS NULL OR r.space_id IS NULL THEN
    RETURN;
  END IF;

  duration_ms := r.end_time - r.start_time;
  IF duration_ms <= 0 THEN
    RETURN;
  END IF;

  SELECT get_actor_size(r.reservable_type, r.reservable_id) INTO actor_size;

  IF r.rrule ILIKE '%DAILY%' THEN
    step_interval := interval '1 day';
  ELSIF r.rrule ILIKE '%WEEKLY%' THEN
    step_interval := interval '1 week';
  ELSIF r.rrule ILIKE '%MONTHLY%' THEN
    step_interval := interval '1 month';
  ELSIF r.rrule ILIKE '%YEARLY%' THEN
    step_interval := interval '1 year';
  ELSE
    step_interval := interval '1 day';
  END IF;

  recurrence_cap_ms := LEAST(
    COALESCE(r.recurrence_end, r.start_time + year_cap_ms),
    r.start_time + year_cap_ms
  );

  DELETE FROM reservation_ledger WHERE reservation_id = _reservation_id;

  occ_ms := r.start_time;
  WHILE occ_ms <= recurrence_cap_ms LOOP
    SELECT * INTO omit, win_s, win_e
    FROM effective_occurrence_window(r.id, occ_ms, duration_ms);

    IF NOT omit AND win_e > now_ms THEN
      PERFORM insert_into_ledger(
        r.id, win_s, win_e,
        r.reservable_type, r.reservable_id, r.space_id,
        r.event_type, r.reason, actor_size, r.status
      );
    END IF;

    EXIT WHEN occ_ms >= recurrence_cap_ms;
    occ_ms := (EXTRACT(EPOCH FROM (to_timestamp(occ_ms / 1000.0) + step_interval)) * 1000)::bigint;
    IF occ_ms <= r.start_time THEN
      EXIT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 16. Rewrite reservation_window_conflicts: resource_id → space_id
-- ============================================================================
CREATE OR REPLACE FUNCTION reservation_window_conflicts(
  _reservation_id text,
  _win_s bigint,
  _win_e bigint
) RETURNS boolean AS $$
DECLARE
  r RECORD;
  cap int;
  exclusive boolean;
  actor_size int;
  overlap int;
BEGIN
  SELECT * INTO r FROM reservations WHERE id = _reservation_id;
  IF NOT FOUND OR r.space_id IS NULL OR _win_e <= _win_s THEN
    RETURN false;
  END IF;

  SELECT capacity, is_exclusive
  INTO cap, exclusive
  FROM spaces
  WHERE id = r.space_id;

  SELECT get_actor_size(r.reservable_type, r.reservable_id) INTO actor_size;

  IF exclusive THEN
    SELECT COUNT(*) INTO overlap
    FROM reservation_ledger l
    WHERE l.space_id = r.space_id
      AND l.status = 'APPROVED'
      AND l.reservation_id <> _reservation_id
      AND l.occurrence_start_time < _win_e
      AND l.occurrence_end_time > _win_s;
    RETURN overlap > 0;
  END IF;

  SELECT COALESCE(MAX(slot_sum), 0) INTO overlap
  FROM (
    SELECT COALESCE((
             SELECT SUM(l.actor_size)
             FROM reservation_ledger l
             WHERE l.space_id = r.space_id
               AND l.status = 'APPROVED'
               AND l.reservation_id <> _reservation_id
               AND l.occurrence_start_time = gs
           ), 0) AS slot_sum
    FROM generate_series(_win_s, _win_e - 1, 900000::bigint) AS gs
  ) slot_check;

  RETURN (overlap + actor_size) > cap;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 17. Rewrite maintain_reservations: resource_id → space_id
-- ============================================================================
CREATE OR REPLACE FUNCTION maintain_reservations()
RETURNS TABLE (
  deleted_past_ledger bigint,
  rebuilt_recurring bigint,
  deleted_reservations bigint
) AS $$
DECLARE
  today_start_ms bigint;
  del_cnt bigint;
  reb_cnt int := 0;
  del_res_cnt bigint := 0;
  del_nr bigint;
  del_rec bigint;
  rec RECORD;
BEGIN
  today_start_ms := (EXTRACT(EPOCH FROM date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') * 1000)::bigint;

  DELETE FROM reservation_ledger WHERE occurrence_end_time < today_start_ms;
  GET DIAGNOSTICS del_cnt = ROW_COUNT;

  FOR rec IN
    SELECT id FROM reservations
    WHERE is_recurring = true
      AND rrule IS NOT NULL
      AND space_id IS NOT NULL
      AND status IN ('PENDING', 'APPROVED')
  LOOP
    PERFORM rebuild_reservation_ledger_forward(rec.id);
    reb_cnt := reb_cnt + 1;
  END LOOP;

  DELETE FROM reservation_ledger
  WHERE reservation_id IN (
    SELECT id FROM reservations
    WHERE is_recurring = false AND end_time < today_start_ms
  );
  DELETE FROM reservations
  WHERE is_recurring = false AND end_time < today_start_ms;
  GET DIAGNOSTICS del_nr = ROW_COUNT;

  DELETE FROM reservation_ledger
  WHERE reservation_id IN (
    SELECT r.id
    FROM reservations r
    WHERE r.is_recurring = true
      AND r.rrule IS NOT NULL
      AND NOT recurring_reservation_has_occurrence_after(r.id, today_start_ms)
  );
  DELETE FROM reservations r
  WHERE r.is_recurring = true
    AND r.rrule IS NOT NULL
    AND NOT recurring_reservation_has_occurrence_after(r.id, today_start_ms);
  GET DIAGNOSTICS del_rec = ROW_COUNT;

  del_res_cnt := del_nr + del_rec;

  RETURN QUERY SELECT del_cnt, reb_cnt::bigint, del_res_cnt;
END;
$$ LANGUAGE plpgsql;
