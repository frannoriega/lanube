-- ============================================================================
-- Milestone 23, slice 3 — red de seguridad en la base para los días cerrados.
--
-- La regla «no se reserva un día cerrado» vive en TypeScript (`requestUserReservation` →
-- `validateAgainstClosures`). Esto es la segunda línea: un trigger sobre `reservations` que
-- rechaza una reserva **puntual de usuario** que pise un cierre activo, para que un camino que
-- llame a `create_reservation()` sin pasar por esa capa no pueda saltearse un cierre.
--
-- Decisión: el ledger NO conoce los cierres (ver docs/milestones/milestones-23-closed-days.md,
-- «Qué hace un cierre»). Un evento o una reserva recurrente que cruza un feriado no se rompe ni
-- se omite en silencio: se marca para que el admin la resuelva (cancelar la sesión con motivo y
-- avisar a los inscriptos). Por eso el trigger solo mira reservas de USUARIO NO recurrentes:
-- `create_event_reservation()` crea eventos semanales que forzosamente cruzan feriados, y
-- hacerlos fallar acá impediría crear un evento que dura más de unas semanas.
--
-- Se hace con un trigger en lugar de recrear `create_reservation()` (≈200 líneas, ya
-- redefinida en 20260924110000) para no duplicar esa lógica de capacidad solo por sumar una guarda.
-- ============================================================================

-- Título del primer cierre ACTIVO que se solapa con la ventana [_start_ms, _end_ms), o NULL.
--
-- Las fechas del cierre son días de calendario locales (America/Argentina/Buenos_Aires, igual
-- que ADMIN_TIMEZONE en TypeScript). Cada día del rango ocupa [medianoche local + start_time,
-- medianoche local + end_time) — sin franja, el día completo —, igual que
-- `closureIntervalOnDay` en src/lib/closed-days/closures.ts: mantener ambas en sintonía.
CREATE OR REPLACE FUNCTION closed_day_overlapping_window(
  _start_ms bigint,
  _end_ms bigint
) RETURNS text AS $$
  SELECT c.title
  FROM closed_days c
  CROSS JOIN LATERAL generate_series(
    c.start_date::date, c.end_date::date, interval '1 day'
  ) AS d(day)
  WHERE c.status = 'ACTIVE'
    -- Poda barata por fecha local antes de expandir días (índice por status/fechas).
    AND c.start_date <= to_char(timezone('America/Argentina/Buenos_Aires', to_timestamp((_end_ms - 1) / 1000.0)), 'YYYY-MM-DD')
    AND c.end_date   >= to_char(timezone('America/Argentina/Buenos_Aires', to_timestamp(_start_ms / 1000.0)), 'YYYY-MM-DD')
    AND _start_ms < (
      (EXTRACT(EPOCH FROM (d.day::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')) * 1000)::bigint
      + COALESCE(c.end_time, 1440)::bigint * 60000
    )
    AND _end_ms > (
      (EXTRACT(EPOCH FROM (d.day::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')) * 1000)::bigint
      + COALESCE(c.start_time, 0)::bigint * 60000
    )
  ORDER BY c.start_date, c.created_at
  LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION reservations_reject_closed_day() RETURNS trigger AS $$
DECLARE
  closed_title text;
BEGIN
  closed_title := closed_day_overlapping_window(NEW.start_time, NEW.end_time);
  IF closed_title IS NOT NULL THEN
    RAISE EXCEPTION 'Closed day: %', closed_title;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservations_no_closed_day
  BEFORE INSERT ON "reservations"
  FOR EACH ROW
  WHEN (NEW.reservable_type = 'USER' AND NOT NEW.is_recurring)
  EXECUTE FUNCTION reservations_reject_closed_day();
