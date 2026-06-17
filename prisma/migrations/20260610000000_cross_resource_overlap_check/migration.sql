-- Prevent a reservable entity from holding overlapping APPROVED reservations
-- across different resources. The check is generic: it operates on
-- (reservable_id, reservable_type) without referencing any specific resource type.
--
-- Changes:
--  1. Index on reservation_ledger(reservable_id, reservable_type, status) to make
--     the cross-resource lookup fast.
--  2. create_reservation() gains a cross-resource overlap guard (non-recurring and
--     per-occurrence for recurring).
--  3. approve_reservation() gains a second auto-reject loop that rejects PENDING
--     reservations of the same reservable on *different* resources when they overlap
--     the just-approved reservation.

-- ============================================================================
-- Index for cross-resource lookups by reservable entity
-- ============================================================================
CREATE INDEX IF NOT EXISTS reservation_ledger_reservable_status_idx
  ON reservation_ledger (reservable_id, reservable_type, status);

-- ============================================================================
CREATE OR REPLACE FUNCTION create_reservation(
  _reservation_id text,
  _reservable_type reservable_types,
  _reservable_id text,
  _resource_type resource_types,
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
  conflict_resource_type text;
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
    WHERE r.type = _resource_type
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
    RAISE EXCEPTION 'No available % resource for the given time window', _resource_type;
  END IF;

  IF NOT _is_recurring THEN
    -- Cross-resource overlap guard: same reservable cannot have overlapping APPROVED reservations
    SELECT r.name, r.type::text
    INTO conflict_resource_name, conflict_resource_type
    FROM reservation_ledger l
    JOIN resources r ON r.id = l.resource_id
    WHERE l.reservable_id   = _reservable_id
      AND l.reservable_type = _reservable_type
      AND l.status          = 'APPROVED'
      AND l.occurrence_start_time < _end_ms
      AND l.occurrence_end_time   > _start_ms
    LIMIT 1;
    IF conflict_resource_name IS NOT NULL THEN
      RAISE EXCEPTION 'Overlap with approved reservation at % (%)', conflict_resource_name, conflict_resource_type;
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
      SELECT r.name, r.type::text
      INTO conflict_resource_name, conflict_resource_type
      FROM reservation_ledger l
      JOIN resources r ON r.id = l.resource_id
      WHERE l.reservable_id   = _reservable_id
        AND l.reservable_type = _reservable_type
        AND l.status          = 'APPROVED'
        AND l.occurrence_start_time < win_e
        AND l.occurrence_end_time   > win_s
      LIMIT 1;
      IF conflict_resource_name IS NOT NULL THEN
        RAISE EXCEPTION 'Overlap with approved reservation at % (%) on occurrence %', conflict_resource_name, conflict_resource_type, occ_ms;
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
         r.resource_id,
         r.reservable_id,
         r.reservable_type,
         r.start_time,
         r.end_time,
         COALESCE(fr.capacity, 1) AS capacity,
         COALESCE(fr.is_exclusive, true) AS is_exclusive
  INTO res
  FROM reservations r
  LEFT JOIN fungible_resources fr ON fr.id = (
    SELECT fungible_resource_id FROM resources WHERE id = r.resource_id
  )
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

  -- Auto-reject conflicting PENDING reservations on the same resource
  FOR overlap IN
    SELECT DISTINCT rl.reservation_id
    FROM reservation_ledger rl
    WHERE rl.resource_id = res.resource_id
      AND rl.status = 'PENDING'
      AND rl.reservation_id <> _reservation_id
      AND EXISTS (
        SELECT 1
        FROM reservation_ledger a
        WHERE a.reservation_id = _reservation_id
          AND a.resource_id = res.resource_id
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
                 WHERE a.resource_id = res.resource_id
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
              AND a.resource_id = res.resource_id
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

  -- Auto-reject PENDING reservations of the same reservable on different resources
  -- that overlap the just-approved reservation (cross-resource conflict enforcement).
  FOR overlap IN
    SELECT DISTINCT rl.reservation_id
    FROM reservation_ledger rl
    WHERE rl.reservable_id   = res.reservable_id
      AND rl.reservable_type = res.reservable_type
      AND rl.status          = 'PENDING'
      AND rl.reservation_id <> _reservation_id
      AND rl.resource_id    <> res.resource_id
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
