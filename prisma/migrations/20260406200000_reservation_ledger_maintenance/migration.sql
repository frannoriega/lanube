-- Ledger maintenance, exception-aware materialization, recurring approve fix.
-- Prune/maintain use UTC calendar-day boundaries (Unix ms aligned with stored timestamps).
-- Cron: call maintain_reservations() daily (e.g. Vercel cron -> secured API route).

-- ============================================================================
-- Effective window for one nominal occurrence (UTC date match on exception_date)
-- ============================================================================
CREATE OR REPLACE FUNCTION effective_occurrence_window(
  _reservation_id text,
  _occ_start_ms bigint,
  _duration_ms bigint,
  OUT omit boolean,
  OUT win_start_ms bigint,
  OUT win_end_ms bigint
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  ex_is_cancelled boolean;
  ex_new_start bigint;
  ex_new_end bigint;
BEGIN
  omit := false;
  win_start_ms := _occ_start_ms;
  win_end_ms := _occ_start_ms + _duration_ms;

  SELECT re.is_cancelled, re.new_start_time, re.new_end_time
  INTO ex_is_cancelled, ex_new_start, ex_new_end
  FROM reservation_exceptions re
  WHERE re.reservation_id = _reservation_id
    AND (to_timestamp(re.exception_date / 1000.0) AT TIME ZONE 'UTC')::date =
        (to_timestamp(_occ_start_ms / 1000.0) AT TIME ZONE 'UTC')::date
  ORDER BY re.created_at DESC
  LIMIT 1;

  IF ex_is_cancelled IS NULL THEN
    RETURN;
  END IF;

  IF ex_is_cancelled THEN
    omit := true;
    RETURN;
  END IF;

  IF ex_new_start IS NOT NULL AND ex_new_end IS NOT NULL AND ex_new_end > ex_new_start THEN
    win_start_ms := ex_new_start;
    win_end_ms := ex_new_end;
    RETURN;
  END IF;
END;
$$;

-- ============================================================================
CREATE OR REPLACE FUNCTION recurring_reservation_has_occurrence_after(
  _reservation_id text,
  _cutoff_ms bigint
) RETURNS boolean AS $$
DECLARE
  r RECORD;
  occ_ms bigint;
  duration_ms bigint;
  recurrence_cap_ms bigint;
  year_cap_ms bigint;
  step_interval interval;
  omit boolean;
  win_s bigint;
  win_e bigint;
BEGIN
  SELECT * INTO r FROM reservations WHERE id = _reservation_id;
  IF NOT FOUND OR NOT r.is_recurring OR r.rrule IS NULL THEN
    RETURN false;
  END IF;

  duration_ms := r.end_time - r.start_time;
  IF duration_ms <= 0 THEN
    RETURN false;
  END IF;

  year_cap_ms := 365::bigint * 86400000;
  recurrence_cap_ms := LEAST(
    COALESCE(r.recurrence_end, r.start_time + year_cap_ms),
    r.start_time + year_cap_ms
  );

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

  occ_ms := r.start_time;
  WHILE occ_ms <= recurrence_cap_ms LOOP
    SELECT * INTO omit, win_s, win_e
    FROM effective_occurrence_window(r.id, occ_ms, duration_ms);

    IF NOT omit AND win_e > _cutoff_ms THEN
      RETURN true;
    END IF;

    EXIT WHEN occ_ms >= recurrence_cap_ms;
    occ_ms := (EXTRACT(EPOCH FROM (to_timestamp(occ_ms / 1000.0) + step_interval)) * 1000)::bigint;
    IF occ_ms <= r.start_time THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

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
  IF NOT FOUND OR NOT r.is_recurring OR r.rrule IS NULL OR r.resource_id IS NULL THEN
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
        r.reservable_type, r.reservable_id, r.resource_id,
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

  RETURN QUERY SELECT _reservation_id, array_to_string(rejected_ids, ',');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_next_reservations(
  _user_id text,
  _resource_type resource_types,
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
      AND (_resource_type IS NULL OR res.type = _resource_type)
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
      AND (_resource_type IS NULL OR res.type = _resource_type)
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
      AND resource_id IS NOT NULL
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
