-- Reschedule-time conflict guard.
--
-- Overlap/capacity validation previously lived only in the *create* functions
-- (create_reservation / create_event_reservation). The reschedule path writes a
-- reservation_exception + rebuild_reservation_ledger_forward(), which re-materializes the
-- ledger with NO conflict check — so a rescheduled occurrence could silently overlap another
-- session on the same resource. This helper lets the application layer validate a proposed new
-- window BEFORE writing the exception (the blind cron rebuild is intentionally left untouched).
--
-- Returns true if placing [_win_s, _win_e) for _reservation_id's resource would conflict with an
-- APPROVED window of a *different* reservation (exclusive resource) or exceed capacity
-- (capacity-based). Self-overlap within the same reservation's own series is intentionally NOT
-- checked here (rare; tracked as a follow-up).
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
  IF NOT FOUND OR r.resource_id IS NULL OR _win_e <= _win_s THEN
    RETURN false;
  END IF;

  SELECT COALESCE(fr.capacity, 1), COALESCE(fr.is_exclusive, true)
  INTO cap, exclusive
  FROM resources res
  LEFT JOIN fungible_resources fr ON fr.id = res.fungible_resource_id
  WHERE res.id = r.resource_id;

  SELECT get_actor_size(r.reservable_type, r.reservable_id) INTO actor_size;

  IF exclusive THEN
    SELECT COUNT(*) INTO overlap
    FROM reservation_ledger l
    WHERE l.resource_id = r.resource_id
      AND l.status = 'APPROVED'
      AND l.reservation_id <> _reservation_id
      AND l.occurrence_start_time < _win_e
      AND l.occurrence_end_time > _win_s;
    RETURN overlap > 0;
  END IF;

  -- Capacity-based: the busiest 15-min slot in the window must leave room for this reservation.
  SELECT COALESCE(MAX(slot_sum), 0) INTO overlap
  FROM (
    SELECT COALESCE((
             SELECT SUM(l.actor_size)
             FROM reservation_ledger l
             WHERE l.resource_id = r.resource_id
               AND l.status = 'APPROVED'
               AND l.reservation_id <> _reservation_id
               AND l.occurrence_start_time = gs
           ), 0) AS slot_sum
    FROM generate_series(_win_s, _win_e - 1, 900000::bigint) AS gs
  ) slot_check;

  RETURN (overlap + actor_size) > cap;
END;
$$ LANGUAGE plpgsql STABLE;
