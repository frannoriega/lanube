-- Update to expand_reservations_for_calendar_by_type
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
    -- Get reservations for ANY resource with OR logic
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

