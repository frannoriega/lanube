-- Milestone 25, DB5: ocurrencias de un usuario dentro de una ventana.
--
-- El calendario de reservas pedía `get_user_next_reservations(user, NULL, 500, 0)` —las
-- próximas 500 desde ahora— y filtraba la semana visible en JS. Costaba lo mismo para cualquier
-- semana, y con muchas reservas recurrentes el techo de 500 se agotaba antes de llegar a semanas
-- lejanas: las reservas propias dejaban de dibujarse en silencio (milestone-12, Parte 4).
--
-- `get_user_reservations_window` es el cuerpo de siempre (copiado sin cambios de la definición de
-- 20260706110000_reservation_types_table) con la ventana [_from_ms, _to_ms] aplicada adentro, y
-- `get_user_next_reservations` pasa a ser un envoltorio sobre ella con la ventana [ahora, ∞) —
-- misma firma, mismo resultado—, así la expansión de recurrencias vive en un solo lugar.

CREATE OR REPLACE FUNCTION get_user_reservations_window(
  _user_id text,
  _space_id text,
  _from_ms bigint,
  _to_ms bigint DEFAULT NULL
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
BEGIN
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
      AND r.start_time >= _from_ms
      AND (_to_ms IS NULL OR r.start_time <= _to_ms)

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
      AND eff.occ_eff_start >= _from_ms
      AND (_to_ms IS NULL OR eff.occ_eff_start <= _to_ms)
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
  ORDER BY er.occurrence_start_time ASC;
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
BEGIN
  RETURN QUERY
  SELECT w.*
  FROM get_user_reservations_window(
    _user_id,
    _space_id,
    (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint,
    NULL
  ) w
  ORDER BY w.occurrence_start_time ASC
  LIMIT _limit
  OFFSET _offset;
END;
$$ LANGUAGE plpgsql;
