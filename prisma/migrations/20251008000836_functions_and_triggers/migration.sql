------------------------------------------------------------
-- DB Logic Setup for Resource Booking Platform
-- Functions, triggers, and indexes
------------------------------------------------------------

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


-- =========================================================
-- 2. Function: check_resource_capacity(_resource_id, _start, _end)
-- =========================================================
-- Verifies whether a resource or its fungible group has capacity.
-- =========================================================

CREATE OR REPLACE FUNCTION check_resource_capacity(
  _resource_id text,
  _start timestamptz,
  _end timestamptz
)
RETURNS boolean AS $$
DECLARE
  group_id text;
  cap int;
  used int;
BEGIN
  SELECT fungible_resource_id INTO group_id
  FROM resources
  WHERE id = _resource_id;

  SELECT capacity INTO cap
  FROM fungible_resources
  WHERE id = group_id;

  IF cap IS NULL THEN
    RAISE EXCEPTION 'Fungible resource group % not found for resource %', group_id, _resource_id;
  END IF;

  SELECT COUNT(*) INTO used
  FROM reservations r
  WHERE (r.resource_id = _resource_id
     OR r.resource_id IN (SELECT id FROM resources WHERE fungible_resource_id = group_id))
    AND r.status IN ('APPROVED', 'PENDING')
    AND r.start_time < _end
    AND r.end_time > _start;

  RETURN used < cap;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- 3. Function: check_availability_with_actor(...)
-- =========================================================
-- Checks capacity while accounting for actor size (user/team/org)
-- =========================================================

CREATE OR REPLACE FUNCTION check_availability_with_actor(
  _resource_id text,
  _reservable_type reservable_types,
  _reservable_id text,
  _start timestamptz,
  _end timestamptz
)
RETURNS boolean AS $$
DECLARE
  cap int;
  used int;
  size int;
  group_id text;
BEGIN
  size := get_actor_size(_reservable_type, _reservable_id);

  SELECT fungible_resource_id INTO group_id
  FROM resources
  WHERE id = _resource_id;

  SELECT capacity INTO cap
  FROM fungible_resources
  WHERE id = group_id;

  IF cap IS NULL THEN
    RAISE EXCEPTION 'No capacity found for resource %', _resource_id;
  END IF;

  SELECT COUNT(*) INTO used
  FROM reservations r
  WHERE (r.resource_id = _resource_id
     OR r.resource_id IN (SELECT id FROM resources WHERE fungible_resource_id = group_id))
    AND r.status IN ('APPROVED', 'PENDING')
    AND r.start_time < _end
    AND r.end_time > _start;

  IF cap < 0 THEN
    RETURN used = 0;
  ELSE
    RETURN (used + size) <= cap;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- 4. Function + Trigger: enforce_reservable_fk()
-- =========================================================
-- Simulates polymorphic FK validation for (reservable_type, reservable_id)
-- Ensures referenced entity exists.
-- =========================================================

CREATE OR REPLACE FUNCTION enforce_reservable_fk()
RETURNS trigger AS $$
BEGIN
  IF NEW.reservable_type = 'USER'
     AND NOT EXISTS (SELECT 1 FROM registered_users WHERE id = NEW.reservable_id) THEN
    RAISE EXCEPTION 'Invalid user id %', NEW.reservable_id;

  ELSIF NEW.reservable_type = 'TEAM'
     AND NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.reservable_id) THEN
    RAISE EXCEPTION 'Invalid team id %', NEW.reservable_id;

  ELSIF NEW.reservable_type = 'ORGANIZATION'
     AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = NEW.reservable_id) THEN
    RAISE EXCEPTION 'Invalid organization id %', NEW.reservable_id;

  ELSIF NEW.reservable_type = 'EVENT'
     AND NOT EXISTS (SELECT 1 FROM events WHERE id = NEW.reservable_id) THEN
    RAISE EXCEPTION 'Invalid event id %', NEW.reservable_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_reservable_fk ON reservations;
CREATE TRIGGER check_reservable_fk
BEFORE INSERT OR UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION enforce_reservable_fk();


-- =========================================================
-- 5. Helper Function: parse_rrule_interval
-- Extracts the INTERVAL value from an rrule string
-- =========================================================
CREATE OR REPLACE FUNCTION parse_rrule_interval(rrule_str text)
RETURNS int AS $$
DECLARE
  interval_val int;
BEGIN
  -- Extract INTERVAL=n from rrule string
  -- Example: "FREQ=DAILY;INTERVAL=2" -> 2
  interval_val := COALESCE(
    (regexp_match(rrule_str, 'INTERVAL=(\d+)'))[1]::int,
    1  -- Default interval is 1
  );
  RETURN interval_val;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- =========================================================
-- 6. Helper Function: parse_rrule_freq
-- Extracts the FREQ value from an rrule string
-- Returns an interval that can be used with generate_series
-- =========================================================
CREATE OR REPLACE FUNCTION parse_rrule_freq(rrule_str text, interval_mult int DEFAULT 1)
RETURNS interval AS $$
DECLARE
  freq text;
BEGIN
  -- Extract FREQ value from rrule string
  -- Example: "FREQ=DAILY;INTERVAL=2" -> "DAILY"
  freq := (regexp_match(rrule_str, 'FREQ=(\w+)'))[1];
  
  -- Convert to PostgreSQL interval
  CASE freq
    WHEN 'DAILY' THEN
      RETURN (interval_mult || ' days')::interval;
    WHEN 'WEEKLY' THEN
      RETURN (interval_mult || ' weeks')::interval;
    WHEN 'MONTHLY' THEN
      RETURN (interval_mult || ' months')::interval;
    WHEN 'YEARLY' THEN
      RETURN (interval_mult || ' years')::interval;
    WHEN 'HOURLY' THEN
      RETURN (interval_mult || ' hours')::interval;
    ELSE
      -- Default to daily if not recognized
      RETURN (interval_mult || ' days')::interval;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- =========================================================
-- 7. Main Function: expand_recurring_reservations
-- Expands all reservations (recurring and non-recurring)
-- with support for filters, limit, and offset
-- =========================================================
CREATE OR REPLACE FUNCTION expand_recurring_reservations(
  p_reservable_type reservable_types DEFAULT NULL,
  p_reservable_id text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_status reservation_statuses DEFAULT NULL,
  p_event_type event_types DEFAULT NULL,
  p_start_time_from timestamptz DEFAULT NULL,
  p_start_time_to timestamptz DEFAULT NULL,
  p_end_time_from timestamptz DEFAULT NULL,
  p_end_time_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  reservation_id text,
  occurrence_date timestamptz,
  occurrence_start_time timestamptz,
  occurrence_end_time timestamptz,
  reservable_type reservable_types,
  reservable_id text,
  resource_id text,
  event_type event_types,
  reason text,
  denied_reason text,
  status reservation_statuses,
  is_recurring boolean,
  is_exception boolean,
  exception_cancelled boolean,
  rrule text,
  recurrence_end timestamptz,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  WITH expanded_reservations AS (
    -- Non-recurring reservations (is_recurring = false)
    SELECT
      r.id as reservation_id,
      r.start_time::timestamptz as occurrence_date,
      r.start_time::timestamptz as occurrence_start_time,
      r.end_time::timestamptz as occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.resource_id,
      r.event_type,
      r.reason,
      r.denied_reason,
      r.status,
      r.is_recurring,
      false as is_exception,
      false as exception_cancelled,
      r.rrule,
      r.recurrence_end::timestamptz,
      r.created_at::timestamptz,
      r.updated_at::timestamptz
    FROM reservations r
    WHERE r.is_recurring = false
    
    UNION ALL
    
    -- Recurring reservations expanded using generate_series
    SELECT
      r.id as reservation_id,
      occurrence::timestamptz as occurrence_date,
      occurrence::timestamptz as occurrence_start_time,
      (occurrence + (r.end_time - r.start_time))::timestamptz as occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.resource_id,
      r.event_type,
      r.reason,
      r.denied_reason,
      r.status,
      r.is_recurring,
      false as is_exception,
      false as exception_cancelled,
      r.rrule,
      r.recurrence_end::timestamptz,
      r.created_at::timestamptz,
      r.updated_at::timestamptz
    FROM reservations r
    CROSS JOIN LATERAL generate_series(
      r.start_time,
      COALESCE(r.recurrence_end, r.start_time + interval '1 year'),
      parse_rrule_freq(r.rrule, parse_rrule_interval(r.rrule))
    ) AS occurrence
    WHERE r.is_recurring = true
      AND r.rrule IS NOT NULL
  ),
  with_exceptions AS (
    SELECT
      er.*,
      re.id as exception_id,
      re.exception_date::timestamptz,
      re.is_cancelled as exc_cancelled,
      re.new_start_time::timestamptz,
      re.new_end_time::timestamptz
    FROM expanded_reservations er
    LEFT JOIN reservation_exceptions re
      ON er.reservation_id = re.reservation_id
      AND DATE(er.occurrence_date) = DATE(re.exception_date)
  ),
  processed AS (
    SELECT
      we.reservation_id,
      we.occurrence_date,
      COALESCE(we.new_start_time, we.occurrence_start_time)::timestamptz as occurrence_start_time,
      COALESCE(we.new_end_time, we.occurrence_end_time)::timestamptz as occurrence_end_time,
      we.reservable_type,
      we.reservable_id,
      we.resource_id,
      we.event_type,
      we.reason,
      we.denied_reason,
      we.status,
      we.is_recurring,
      (we.exception_id IS NOT NULL) as is_exception,
      COALESCE(we.exc_cancelled, false) as exception_cancelled,
      we.rrule,
      we.recurrence_end,
      we.created_at,
      we.updated_at
    FROM with_exceptions we
    -- Exclude cancelled exceptions
    WHERE NOT COALESCE(we.exc_cancelled, false)
  )
  SELECT
    p.reservation_id,
    p.occurrence_date,
    p.occurrence_start_time,
    p.occurrence_end_time,
    p.reservable_type,
    p.reservable_id,
    p.resource_id,
    p.event_type,
    p.reason,
    p.denied_reason,
    p.status,
    p.is_recurring,
    p.is_exception,
    p.exception_cancelled,
    p.rrule,
    p.recurrence_end,
    p.created_at,
    p.updated_at
  FROM processed p
  WHERE
    -- Apply filters
    (p_reservable_type IS NULL OR p.reservable_type = p_reservable_type)
    AND (p_reservable_id IS NULL OR p.reservable_id = p_reservable_id)
    AND (p_resource_id IS NULL OR p.resource_id = p_resource_id)
    AND (p_status IS NULL OR p.status = p_status)
    AND (p_event_type IS NULL OR p.event_type = p_event_type)
    AND (p_start_time_from IS NULL OR p.occurrence_start_time >= p_start_time_from)
    AND (p_start_time_to IS NULL OR p.occurrence_start_time <= p_start_time_to)
    AND (p_end_time_from IS NULL OR p.occurrence_end_time >= p_end_time_from)
    AND (p_end_time_to IS NULL OR p.occurrence_end_time <= p_end_time_to)
  ORDER BY p.occurrence_start_time DESC, p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- 8. Count Function: count_expanded_reservations
-- Returns the total count of expanded reservations matching filters
-- =========================================================
CREATE OR REPLACE FUNCTION count_expanded_reservations(
  p_reservable_type reservable_types DEFAULT NULL,
  p_reservable_id text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_status reservation_statuses DEFAULT NULL,
  p_event_type event_types DEFAULT NULL,
  p_start_time_from timestamptz DEFAULT NULL,
  p_start_time_to timestamptz DEFAULT NULL,
  p_end_time_from timestamptz DEFAULT NULL,
  p_end_time_to timestamptz DEFAULT NULL
)
RETURNS bigint AS $$
DECLARE
  total_count bigint;
BEGIN
  SELECT COUNT(*)
  INTO total_count
  FROM expand_recurring_reservations(
    p_reservable_type,
    p_reservable_id,
    p_resource_id,
    p_status,
    p_event_type,
    p_start_time_from,
    p_start_time_to,
    p_end_time_from,
    p_end_time_to,
    999999, -- Large limit to count all
    0
  );
  
  RETURN total_count;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- 9. Function: expand_reservations_for_calendar_by_type
-- Shows reservations for all resources of a given type
-- Finds all fungible resources of the type, then all their resources
-- Returns APPROVED reservations OR user's own reservations
-- =========================================================
CREATE OR REPLACE FUNCTION expand_reservations_for_calendar_by_type(
  p_resource_type resource_types,
  p_user_id text,
  p_start_time timestamptz,
  p_end_time timestamptz
)
RETURNS TABLE (
  reservation_id text,
  occurrence_date timestamptz,
  occurrence_start_time timestamptz,
  occurrence_end_time timestamptz,
  reservable_type reservable_types,
  reservable_id text,
  resource_id text,
  event_type event_types,
  reason text,
  denied_reason text,
  status reservation_statuses,
  is_recurring boolean,
  is_exception boolean,
  exception_cancelled boolean,
  rrule text,
  recurrence_end timestamptz,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  WITH fungible_resources_of_type AS (
    -- Get all fungible resources of this type
    SELECT id FROM fungible_resources WHERE type = p_resource_type
  ),
  resource_ids AS (
    -- Get all individual resources from all fungible groups of this type
    SELECT id FROM resources 
    WHERE fungible_resource_id IN (SELECT id FROM fungible_resources_of_type)
  ),
  filtered_reservations AS (
    -- Get reservations for ANY resource in the group with OR logic
    SELECT r.*
    FROM reservations r
    WHERE r.resource_id IN (SELECT id FROM resource_ids)
      AND r.start_time < p_end_time
      AND r.end_time > p_start_time
      AND (
        -- APPROVED reservations (occupied space)
        r.status = 'APPROVED'
        OR
        -- User's own reservations (PENDING or APPROVED)
        (r.reservable_type = 'USER' 
         AND r.reservable_id = p_user_id 
         AND r.status IN ('PENDING', 'APPROVED'))
      )
  ),
  expanded_reservations AS (
    -- Non-recurring reservations
    SELECT
      r.id as reservation_id,
      r.start_time::timestamptz as occurrence_date,
      r.start_time::timestamptz as occurrence_start_time,
      r.end_time::timestamptz as occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.resource_id,
      r.event_type,
      r.reason,
      r.denied_reason,
      r.status,
      r.is_recurring,
      false as is_exception,
      false as exception_cancelled,
      r.rrule,
      r.recurrence_end::timestamptz,
      r.created_at::timestamptz,
      r.updated_at::timestamptz
    FROM filtered_reservations r
    WHERE r.is_recurring = false
    
    UNION ALL
    
    -- Recurring reservations expanded
    SELECT
      r.id as reservation_id,
      occurrence::timestamptz as occurrence_date,
      occurrence::timestamptz as occurrence_start_time,
      (occurrence + (r.end_time - r.start_time))::timestamptz as occurrence_end_time,
      r.reservable_type,
      r.reservable_id,
      r.resource_id,
      r.event_type,
      r.reason,
      r.denied_reason,
      r.status,
      r.is_recurring,
      false as is_exception,
      false as exception_cancelled,
      r.rrule,
      r.recurrence_end::timestamptz,
      r.created_at::timestamptz,
      r.updated_at::timestamptz
    FROM filtered_reservations r
    CROSS JOIN LATERAL generate_series(
      r.start_time,
      COALESCE(r.recurrence_end, r.start_time + interval '1 year'),
      parse_rrule_freq(r.rrule, parse_rrule_interval(r.rrule))
    ) AS occurrence
    WHERE r.is_recurring = true
      AND r.rrule IS NOT NULL
      -- Only return occurrences within the requested time range
      AND occurrence::timestamptz < p_end_time
      AND (occurrence + (r.end_time - r.start_time))::timestamptz > p_start_time
  ),
  with_exceptions AS (
    SELECT
      er.*,
      re.id as exception_id,
      re.exception_date::timestamptz,
      re.is_cancelled as exc_cancelled,
      re.new_start_time::timestamptz,
      re.new_end_time::timestamptz
    FROM expanded_reservations er
    LEFT JOIN reservation_exceptions re
      ON er.reservation_id = re.reservation_id
      AND DATE(er.occurrence_date) = DATE(re.exception_date)
  ),
  processed AS (
    SELECT
      we.reservation_id,
      we.occurrence_date,
      COALESCE(we.new_start_time, we.occurrence_start_time)::timestamptz as occurrence_start_time,
      COALESCE(we.new_end_time, we.occurrence_end_time)::timestamptz as occurrence_end_time,
      we.reservable_type,
      we.reservable_id,
      we.resource_id,
      we.event_type,
      we.reason,
      we.denied_reason,
      we.status,
      we.is_recurring,
      (we.exception_id IS NOT NULL) as is_exception,
      COALESCE(we.exc_cancelled, false) as exception_cancelled,
      we.rrule,
      we.recurrence_end,
      we.created_at,
      we.updated_at
    FROM with_exceptions we
    WHERE NOT COALESCE(we.exc_cancelled, false)
  )
  SELECT
    p.reservation_id,
    p.occurrence_date,
    p.occurrence_start_time,
    p.occurrence_end_time,
    p.reservable_type,
    p.reservable_id,
    p.resource_id,
    p.event_type,
    p.reason,
    p.denied_reason,
    p.status,
    p.is_recurring,
    p.is_exception,
    p.exception_cancelled,
    p.rrule,
    p.recurrence_end,
    p.created_at,
    p.updated_at
  FROM processed p
  ORDER BY p.occurrence_start_time ASC;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- Create indexes to improve performance
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_reservations_recurring 
  ON reservations(is_recurring) 
  WHERE is_recurring = true;

CREATE INDEX IF NOT EXISTS idx_reservation_exceptions_date 
  ON reservation_exceptions(reservation_id, exception_date);

------------------------------------------------------------
-- End of custom DB logic setup
------------------------------------------------------------

-- =========================================================
-- 10. Reservation Ledger View + Functions
-- =========================================================

-- Materialized ledger table to avoid recomputing on every request
-- Stores expanded occurrences with actor size for quick aggregation
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'reservation_ledger'
  ) THEN
    CREATE TABLE reservation_ledger (
      id text PRIMARY KEY DEFAULT gen_random_uuid(),
      reservation_id text NOT NULL,
      occurrence_start_time timestamptz NOT NULL,
      occurrence_end_time timestamptz NOT NULL,
      reservable_type reservable_types NOT NULL,
      reservable_id text NOT NULL,
      resource_id text NOT NULL,
      event_type event_types NOT NULL,
      reason text,
      actor_size int NOT NULL,
      status reservation_statuses NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_resource_time
      ON reservation_ledger(resource_id, occurrence_start_time, occurrence_end_time);
  END IF;
END $$;

-- Rebuild ledger from base reservations (idempotent refresh)
CREATE OR REPLACE FUNCTION rebuild_reservation_ledger(
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Optional window to limit rebuild scope
  IF p_start IS NULL OR p_end IS NULL THEN
    DELETE FROM reservation_ledger;  
  ELSE
    DELETE FROM reservation_ledger l
    USING reservations r
    WHERE l.reservation_id = r.id
      AND r.start_time < p_end
      AND r.end_time > p_start;
  END IF;

  INSERT INTO reservation_ledger (
    reservation_id,
    occurrence_start_time,
    occurrence_end_time,
    reservable_type,
    reservable_id,
    resource_id,
    event_type,
    reason,
    actor_size,
    status
  )
  SELECT
    r.id,
    occ.occurrence_start_time,
    occ.occurrence_end_time,
    r.reservable_type,
    r.reservable_id,
    r.resource_id,
    r.event_type,
    r.reason,
    get_actor_size(r.reservable_type, r.reservable_id) AS actor_size,
    r.status
  FROM (
    SELECT
      r.id,
      r.resource_id,
      r.reservable_type,
      r.reservable_id,
      r.status,
      r.rrule,
      r.is_recurring,
      r.start_time AS base_start,
      r.end_time AS base_end,
      r.recurrence_end
    FROM reservations r
    WHERE (p_start IS NULL OR r.start_time < p_end)
      AND (p_end IS NULL OR r.end_time > p_start)
  ) r
  CROSS JOIN LATERAL (
    -- Expand occurrences
    SELECT
      CASE WHEN r.is_recurring = TRUE AND r.rrule IS NOT NULL THEN gs::timestamptz ELSE r.base_start::timestamptz END AS occurrence_start_time,
      CASE WHEN r.is_recurring = TRUE AND r.rrule IS NOT NULL THEN (gs + (r.base_end - r.base_start))::timestamptz ELSE r.base_end::timestamptz END   AS occurrence_end_time
    FROM (
      SELECT generate_series(
        r.base_start,
        COALESCE(r.recurrence_end, r.base_start + interval '1 year'),
        parse_rrule_freq(r.rrule, parse_rrule_interval(r.rrule))
      ) AS gs
      WHERE r.is_recurring = TRUE AND r.rrule IS NOT NULL
      UNION ALL
      SELECT r.base_start
      WHERE r.is_recurring = FALSE OR r.rrule IS NULL
    ) s
  ) occ
  WHERE occ.occurrence_start_time < COALESCE(p_end, occ.occurrence_end_time + interval '100 years')
    AND occ.occurrence_end_time > COALESCE(p_start, occ.occurrence_start_time - interval '100 years');
END;
$$ LANGUAGE plpgsql;

-- Get ledger rows by fungible resource type and time window
CREATE OR REPLACE FUNCTION get_reservation_ledger_by_type(
  p_resource_type resource_types,
  p_start_time timestamptz,
  p_end_time timestamptz
)
RETURNS TABLE (
  reservation_id text,
  occurrence_start_time timestamptz,
  occurrence_end_time timestamptz,
  reservable_type reservable_types,
  reservable_id text,
  resource_id text,
  actor_size int,
  status reservation_statuses
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.reservation_id,
    l.occurrence_start_time,
    l.occurrence_end_time,
    l.reservable_type,
    l.reservable_id,
    l.resource_id,
    l.event_type,
    l.reason,
    l.actor_size,
    l.status
  FROM reservation_ledger l
  WHERE l.resource_id IN (
    SELECT id FROM resources WHERE fungible_resource_id IN (
      SELECT id FROM fungible_resources WHERE type = p_resource_type
    )
  )
    AND l.occurrence_start_time < p_end_time
    AND l.occurrence_end_time > p_start_time
  ORDER BY l.occurrence_start_time;
END;
$$ LANGUAGE plpgsql;

-- Find full-capacity time slots per fungible resource type
-- Returns merged continuous slots where sum(actor_size) >= capacity
CREATE OR REPLACE FUNCTION find_full_capacity_slots_by_type(
  p_resource_type resource_types,
  p_start_time timestamptz,
  p_end_time timestamptz
)
RETURNS TABLE (
  slot_start timestamptz,
  slot_end timestamptz,
  capacity int,
  total_used int
) AS $$
BEGIN
  RETURN QUERY
  WITH target_resources AS (
    SELECT fr.id AS fr_id, fr.capacity
    FROM fungible_resources fr
    WHERE fr.type = p_resource_type
  ),
  ledger AS (
    SELECT l.*, r.fungible_resource_id AS fr_id
    FROM reservation_ledger l
    JOIN resources r ON r.id = l.resource_id
    WHERE l.occurrence_start_time < p_end_time
      AND l.occurrence_end_time > p_start_time
  ),
  endpoints AS (
    SELECT fr_id, occurrence_start_time AS ts, 1 AS kind, actor_size FROM ledger
    UNION ALL
    SELECT fr_id, occurrence_end_time   AS ts, -1 AS kind, actor_size FROM ledger
  ),
  ordered AS (
    SELECT fr_id, ts, kind, actor_size
    FROM endpoints
    ORDER BY fr_id, ts, kind DESC -- start before end at same timestamp
  ),
  sweep AS (
    SELECT fr_id, ts,
           SUM(CASE WHEN kind = 1 THEN actor_size ELSE -actor_size END) OVER (
             PARTITION BY fr_id ORDER BY ts, kind DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS used
    FROM ordered
  ),
  next_ts AS (
    SELECT s.fr_id, s.ts AS slot_start,
           LEAD(s.ts) OVER (PARTITION BY s.fr_id ORDER BY s.ts) AS slot_end,
           s.used
    FROM sweep s
  ),
  joined AS (
    SELECT n.fr_id, n.slot_start, n.slot_end, n.used, tr.capacity
    FROM next_ts n
    JOIN target_resources tr ON tr.fr_id = n.fr_id
    WHERE n.slot_end IS NOT NULL
  ),
  full AS (
    SELECT slot_start, slot_end, capacity, used AS total_used
    FROM joined
    WHERE used >= capacity AND slot_end > slot_start
  ),
  merged AS (
    SELECT slot_start, slot_end, capacity, total_used,
           SUM(CASE WHEN is_new_group THEN 1 ELSE 0 END) OVER (ORDER BY slot_start) AS grp
    FROM (
      SELECT f.*,
             (LAG(f.slot_end) OVER (ORDER BY f.slot_start) IS NULL OR LAG(f.slot_end) OVER (ORDER BY f.slot_start) < f.slot_start)
             AS is_new_group
      FROM full f
    ) x
  )
  SELECT MIN(slot_start) AS slot_start,
         MAX(slot_end)   AS slot_end,
         MAX(capacity)   AS capacity,
         MAX(total_used) AS total_used
  FROM merged
  GROUP BY grp
  ORDER BY slot_start;
END;
$$ LANGUAGE plpgsql;
