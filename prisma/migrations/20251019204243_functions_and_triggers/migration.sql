-- =========================================================
-- 1. Function: get_actor_size(_type, _id)
-- =========================================================
-- Calculates how many registered users are represented
-- by a reservable entity (USER, TEAM, ORGANIZATION)
-- =========================================================

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
  ELSE
    size := 1;
  END IF;

  RETURN COALESCE(size, 1);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION insert_into_ledger(
  _reservation_id text,
  _occurrence_start_time timestamptz,
  _reservable_type reservable_types,
  _reservable_id text,
  _resource_id text,
  _event_type event_types,
  _reason text,
  _actor_size int,
  _status reservation_statuses
)
RETURNS void AS $$
DECLARE
  bucket_start timestamptz;
BEGIN
  FOR bucket_start IN 
    SELECT generate_series(
      _occurrence_start_time,
      _occurrence_end_time,
      interval '15 minutes'
    ) AS bucket_start
    WHERE bucket_start < _occurrence_end_time
  LOOP
    INSERT INTO reservation_ledger (
      id, reservation_id, occurrence_start_time, occurrence_end_time,
      reservable_type, reservable_id, resource_id, event_type,
      reason, actor_size, status
    )
    VALUES (
      nextval('reservation_ledger_id_seq'), _reservation_id, bucket_start, bucket_start + interval '15 minutes',
      _reservable_type, _reservable_id, _resource_id,
      _event_type, _reason, _actor_size, _status
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;
------------------------------------------------------------
-- Smart create_reservation()
-- Simplified: each resource has at most one fungible_resource
-- and new reservations start as PENDING
------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_reservation(
  _reservation_id text,
  _reservable_type reservable_types,
  _reservable_id text,
  _resource_type resource_types,
  _event_type event_types,
  _reason text,
  _start timestamptz,
  _end timestamptz,
  _is_recurring boolean DEFAULT false,
  _rrule text DEFAULT NULL,
  _recurrence_end timestamptz DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  actor_size int;
  chosen_resource text;
  cap int;
  exclusive boolean;
  overlap int;
  occ record;
BEGIN
  -- Compute actor size
  SELECT get_actor_size(_reservable_type, _reservable_id)
  INTO actor_size;

  -- Find an available resource of the given type
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
        AND l.occurrence_start_time < _end
        AND l.occurrence_end_time > _start;

      IF overlap = 0 THEN
        EXIT;  -- available
      END IF;

    ELSE
      SELECT COALESCE(SUM(l.actor_size), 0)
        INTO overlap
      FROM reservation_ledger l
      WHERE l.resource_id = chosen_resource
        AND l.status = 'APPROVED'
        AND l.occurrence_start_time < _end
        AND l.occurrence_end_time > _start;

      IF (overlap + actor_size) <= cap THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF chosen_resource IS NULL THEN
    RAISE EXCEPTION 'No available % resource for the given time window', _resource_type;
  END IF;

  -- Non-recurring reservation
  IF NOT _is_recurring THEN
    INSERT INTO reservations (
      id, reservable_type, reservable_id, resource_id,
      event_type, reason, start_time, end_time,
      is_recurring, rrule, recurrence_end, status,
      created_at, updated_at
    )
    VALUES (
      _reservation_id, _reservable_type, _reservable_id, chosen_resource,
      _event_type, _reason, _start, _end,
      false, NULL, NULL, 'PENDING',
      now(), now()
    );

    PERFORM insert_into_ledger(_reservation_id, _start, _end, _reservable_type, _reservable_id, chosen_resource, _event_type, _reason, actor_size, 'PENDING');

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
    _event_type, _reason, _start, _end,
    true, _rrule, _recurrence_end, 'PENDING',
    now(), now()
  );

  -- Recurring reservations (simplified RRULE expansion)
  FOR occ IN
    SELECT generate_series(
      _start,
      COALESCE(_recurrence_end, _start + interval '1 year'),
      CASE
        WHEN _rrule ILIKE '%DAILY%' THEN interval '1 day'
        WHEN _rrule ILIKE '%WEEKLY%' THEN interval '1 week'
        WHEN _rrule ILIKE '%MONTHLY%' THEN interval '1 month'
        WHEN _rrule ILIKE '%YEARLY%' THEN interval '1 year'
        ELSE interval '1 day'
      END
    ) AS occ_start
  LOOP
    EXIT WHEN occ.occ_start > COALESCE(_recurrence_end, occ.occ_start);

    SELECT COUNT(*) INTO overlap
    FROM reservation_ledger l
    WHERE l.resource_id = chosen_resource
      AND l.status = 'APPROVED'
      AND l.occurrence_start_time < occ.occ_start + (_end - _start)
      AND l.occurrence_end_time > occ.occ_start;

    IF exclusive AND overlap > 0 THEN
      RAISE EXCEPTION 'Conflict on %', occ.occ_start;
    ELSIF NOT exclusive AND (overlap + actor_size) > cap THEN
      RAISE EXCEPTION 'Capacity exceeded on %', occ.occ_start;
    END IF;

    PERFORM insert_into_ledger(_reservation_id, occ.occ_start, occ.occ_start + (_end - _start), _reservable_type, _reservable_id, chosen_resource, _event_type, _reason, actor_size, 'PENDING');
  END LOOP;

END;
$$ LANGUAGE plpgsql;

------------------------------------------------------------
-- Approve a reservation, reject conflicting pending ones
------------------------------------------------------------

CREATE OR REPLACE FUNCTION approve_reservation(_reservation_id text)
RETURNS TABLE(approved_id text, auto_rejected_ids text) AS $$
DECLARE
  res RECORD;
  cap int;
  exclusive boolean;
  used int;
  overlap RECORD;
  rejected_ids text[];
BEGIN
  rejected_ids := ARRAY[]::text[];

  -- Get reservation details
  SELECT r.id AS reservation_id,
         r.resource_id,
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

  -- Step 1. Approve the reservation itself
  UPDATE reservations
    SET status = 'APPROVED', updated_at = now()
    WHERE id = _reservation_id;

  UPDATE reservation_ledger
    SET status = 'APPROVED'
    WHERE reservation_id = _reservation_id;

  -- Step 2. Handle conflicting pending reservations
  FOR overlap IN
    SELECT rl.reservation_id,
           SUM(rl.actor_size) AS total_size
    FROM reservation_ledger rl
    WHERE rl.resource_id = res.resource_id
      AND rl.status = 'PENDING'
      AND rl.occurrence_start_time < res.end_time
      AND rl.occurrence_end_time > res.start_time
    GROUP BY rl.reservation_id
  LOOP
    IF exclusive THEN
      -- Exclusive resource: only one can exist
      UPDATE reservations SET status = 'REJECTED'
        WHERE id = overlap.reservation_id;
      UPDATE reservation_ledger SET status = 'REJECTED'
        WHERE reservation_id = overlap.reservation_id;
      rejected_ids := array_append(rejected_ids, overlap.reservation_id);
    ELSE
      -- Non-exclusive (capacity-based)
      SELECT COALESCE(SUM(actor_size), 0)
      INTO used
      FROM reservation_ledger
      WHERE resource_id = res.resource_id
        AND status = 'APPROVED'
        AND occurrence_start_time < res.end_time
        AND occurrence_end_time > res.start_time;

      IF (used + overlap.total_size) > cap THEN
        -- This pending one cannot fit anymore
        UPDATE reservations
          SET status = 'REJECTED', updated_at = now()
          WHERE id = overlap.reservation_id;

        UPDATE reservation_ledger
          SET status = 'REJECTED'
          WHERE reservation_id = overlap.reservation_id;
        rejected_ids := array_append(rejected_ids, overlap.reservation_id);
      END IF;
    END IF;
  END LOOP;

  -- Return results
  RETURN QUERY SELECT _reservation_id, array_to_string(rejected_ids, ',');
END;
$$ LANGUAGE plpgsql;

------------------------------------------------------------
-- Get unavailable time slots for a resource type
------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_unavailable_slots(
  _resource_type resource_types,
  _from timestamptz,
  _to timestamptz,
  _exclude_user_id text DEFAULT NULL
)
RETURNS TABLE (
  resource_id text,
  start_time timestamptz,
  end_time timestamptz
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
    WHERE r.type = _resource_type
      AND l.status = 'APPROVED'
      AND l.occurrence_start_time < _to
      AND l.occurrence_end_time > _from
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

------------------------------------------------------------
-- Get user's next reservations (expanded with recurrences)
------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_next_reservations(
  _user_id text,
  _resource_type resource_types,
  _limit int DEFAULT 10,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id text,
  reservation_id text,
  occurrence_start_time timestamptz,
  occurrence_end_time timestamptz,
  reservable_type reservable_types,
  reservable_id text,
  resource_id text,
  event_type event_types,
  reason text,
  actor_size int,
  status reservation_statuses,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  WITH expanded_reservations AS (
    -- Non-recurring reservations
    SELECT 
      r.id::text as id,
      r.id::text as reservation_id,
      r.start_time as occurrence_start_time,
      r.end_time as occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.resource_id,
      r.event_type,
      r.reason,
      get_actor_size(r.reservable_type, r.reservable_id) as actor_size,
      r.status,
      r.created_at
    FROM reservations r
    JOIN resources res ON res.id = r.resource_id
    WHERE r.reservable_type = 'USER'
      AND (_resource_type IS NULL OR res.type = _resource_type)
      AND r.reservable_id = _user_id
      AND r.is_recurring = false
      AND r.start_time >= NOW()
    
    UNION ALL
    
    -- Recurring reservations (expanded using generate_series)
    SELECT 
      (r.id || '_' || EXTRACT(EPOCH FROM occ_start)::text) as id,
      r.id::text as reservation_id,
      occ_start as occurrence_start_time,
      occ_start + (r.end_time - r.start_time) as occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.resource_id,
      r.event_type,
      r.reason,
      get_actor_size(r.reservable_type, r.reservable_id) as actor_size,
      r.status,
      r.created_at
    FROM reservations r
    CROSS JOIN LATERAL generate_series(
      r.start_time,
      LEAST(
        COALESCE(r.recurrence_end, r.start_time + interval '1 year'),
        r.start_time + interval '1 year'
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
    WHERE r.reservable_type = 'USER'
      AND (_resource_type IS NULL OR res.type = _resource_type)
      AND r.reservable_id = _user_id
      AND r.is_recurring = true
      AND occ_start >= NOW()
      AND occ_start <= LEAST(
        COALESCE(r.recurrence_end, r.start_time + interval '1 year'),
        r.start_time + interval '1 year'
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
