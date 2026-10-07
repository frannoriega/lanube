-- Milestone 25, C3: las reservas recurrentes se cuentan por ocurrencia, no por su serie.
--
-- Reportes, tableros y los listados por rango de /admin/reservations filtraban por
-- `reservations.start_time`, que en una recurrente es el inicio de la SERIE: una reserva semanal
-- creada hace meses no aparecía en la semana actual, y en un reporte contaba una sola vez con la
-- duración de una ocurrencia. Decisión del usuario (2026-10-07): se cuenta cada ocurrencia que
-- cae en el período, con sus excepciones.
--
-- No se lee del ledger: `maintain_reservations()` borra cada día los buckets ya pasados, así
-- que el ledger solo sirve hacia adelante y los reportes miran sobre todo el pasado. Esta función
-- expande desde `reservations` + `reservation_exceptions` con **la misma regla que arma el
-- ledger** (`rebuild_reservation_ledger_forward`): paso según la frecuencia del RRULE, desde
-- `start_time` hasta `min(recurrence_end, start_time + 1 año)` inclusive, y cada ocurrencia
-- pasada por `effective_occurrence_window` (cancelada → se omite; reprogramada → su ventana
-- nueva). Así lo que se cuenta es lo mismo que lo que ocupa capacidad.
--
-- Una ocurrencia pertenece a la ventana si su inicio EFECTIVO cae en [_from_ms, _to_ms] (los
-- dos extremos incluidos, como el `lte` que usaban los listados). Se devuelven todos los estados:
-- cada consumidor filtra el suyo. Los filtros opcionales (`_reservable_type`, `_reservable_id`,
-- `_space_id`) recortan las series ANTES de expandirlas — el tablero de un usuario no expande las
-- de todos.

CREATE OR REPLACE FUNCTION reservation_occurrences(
  _from_ms bigint,
  _to_ms bigint,
  _reservable_type reservable_types DEFAULT NULL,
  _reservable_id text DEFAULT NULL,
  _space_id text DEFAULT NULL
)
RETURNS TABLE (
  reservation_id text,
  occurrence_start_time bigint,
  occurrence_end_time bigint
)
LANGUAGE sql
STABLE
AS $$
  -- Únicas (y una "recurrente" sin RRULE, que el ledger también trata como única: no la expande).
  SELECT r.id, r.start_time, r.end_time
  FROM reservations r
  WHERE (r.is_recurring = false OR r.rrule IS NULL)
    AND r.start_time BETWEEN _from_ms AND _to_ms
    AND (_reservable_type IS NULL OR r.reservable_type = _reservable_type)
    AND (_reservable_id IS NULL OR r.reservable_id = _reservable_id)
    AND (_space_id IS NULL OR r.space_id = _space_id)

  UNION ALL

  SELECT r.id, w.win_start_ms, w.win_end_ms
  FROM reservations r
  CROSS JOIN LATERAL (
    SELECT
      LEAST(
        COALESCE(r.recurrence_end, r.start_time + 365::bigint * 86400000),
        r.start_time + 365::bigint * 86400000
      ) AS cap_ms,
      CASE
        WHEN r.rrule ILIKE '%DAILY%' THEN interval '1 day'
        WHEN r.rrule ILIKE '%WEEKLY%' THEN interval '1 week'
        WHEN r.rrule ILIKE '%MONTHLY%' THEN interval '1 month'
        WHEN r.rrule ILIKE '%YEARLY%' THEN interval '1 year'
        ELSE interval '1 day'
      END AS step
  ) s
  CROSS JOIN LATERAL generate_series(
    to_timestamp(r.start_time / 1000.0),
    to_timestamp(s.cap_ms / 1000.0),
    s.step
  ) AS occ
  CROSS JOIN LATERAL effective_occurrence_window(
    r.id,
    (EXTRACT(EPOCH FROM occ) * 1000)::bigint,
    r.end_time - r.start_time
  ) w
  WHERE r.is_recurring = true
    AND r.rrule IS NOT NULL
    AND r.end_time > r.start_time
    AND (_reservable_type IS NULL OR r.reservable_type = _reservable_type)
    AND (_reservable_id IS NULL OR r.reservable_id = _reservable_id)
    AND (_space_id IS NULL OR r.space_id = _space_id)
    -- Poda gruesa de series que no pueden tocar la ventana. El margen de 31 días cubre una
    -- ocurrencia reprogramada fuera de su fecha nominal (una excepción puede moverla).
    AND r.start_time <= _to_ms + 31::bigint * 86400000
    AND s.cap_ms >= _from_ms - 31::bigint * 86400000
    AND NOT w.omit
    AND w.win_start_ms BETWEEN _from_ms AND _to_ms
$$;
