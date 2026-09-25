-- ============================================================================
-- Milestone 12 — Retención del historial de reportes (D7, segunda parte; D22)
--
-- D22: `/api/cron/report-snapshot` hace INSERT sobre `report_snapshots`, pero esa
-- tabla NO EXISTÍA: no hay migración ni modelo Prisma que la cree. El endpoint
-- habría fallado con "relation report_snapshots does not exist" en cada
-- invocación. Nunca se notó porque tampoco estaba agendado en vercel.json, así
-- que jamás se ejecutó. Esta migración la crea de verdad.
--
-- D7 (cierre): el slice D detuvo el borrado diario de `reservations`, que era lo
-- que dejaba a /admin/reports sin historial. Eso dejó abierta la pregunta de
-- cuánto conservar. Respuesta (2026-09-25): 3 años de historial de reportes,
-- compactado — el detalle crudo se conserva 12 meses y después vive solo como
-- agregado mensual.
--
-- La garantía importante está en prune_reservation_history(): una fila cruda
-- solo se borra si YA EXISTE el snapshot mensual que la cubre. Si el cron de
-- snapshots falla, la limpieza se posterga; nunca se pierde información.
-- ============================================================================

CREATE TABLE "report_snapshots" (
    "id"        TEXT NOT NULL,
    -- Clave estable y legible: MONTHLY_2026_09 / YEARLY_2026. Es el ON CONFLICT
    -- del cron, que recalcula el mes en curso hasta que queda cerrado.
    "key"       TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "year"      INTEGER NOT NULL,
    "month"     INTEGER,
    "from_date" TEXT NOT NULL,
    "to_date"   TEXT NOT NULL,
    -- El ReportData ya calculado. jsonb y no columnas: la forma del reporte la
    -- define src/types/stats/report.ts y cambia con el producto; un snapshot es
    -- una foto de lo que el reporte decía entonces, no un esquema a mantener.
    "data"      JSONB NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint,

    CONSTRAINT "report_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_snapshots_key_key" ON "report_snapshots"("key");
CREATE INDEX "report_snapshots_year_month_idx" ON "report_snapshots"("year", "month");
CREATE INDEX "report_snapshots_from_date_idx" ON "report_snapshots"("from_date");

-- ----------------------------------------------------------------------------
-- Poda del detalle crudo, condicionada a que el mes ya esté compactado.
--
-- `_raw_cutoff_ms` lo calcula la aplicación a partir de RAW_RETENTION_MONTHS
-- (src/lib/constants/retention.ts), así la política vive en un solo lugar.
--
-- Una reserva se borra solo si se cumplen las dos condiciones:
--   1. terminó antes del corte (para las recurrentes, terminó toda la serie), y
--   2. existe un snapshot MONTHLY cuyo rango [from_date, to_date] cubre su fin.
--
-- El ledger se va solo: tiene ON DELETE CASCADE desde 20260924100000.
-- Los check_ins NO se borran — sobreviven con reservation_id en NULL
-- (check_ins_reservation_id_fkey es ON DELETE SET NULL). Es deliberado: el
-- registro de quién entró al espacio es su propio dato, no un detalle de la
-- reserva que lo justificó.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prune_reservation_history(_raw_cutoff_ms bigint)
RETURNS TABLE (
  deleted_reservations bigint,
  skipped_unsnapshotted bigint
) AS $$
DECLARE
  del_cnt bigint := 0;
  skip_cnt bigint := 0;
BEGIN
  -- Sin tablas temporales: con ON COMMIT DROP sobreviven hasta el commit, así que
  -- dos llamadas dentro de la misma transacción chocaban con "relation already
  -- exists". El cron llama una sola vez por request, pero una función que no se
  -- puede llamar dos veces es una trampa para el próximo que la use (y rompió su
  -- propio test).

  -- Candidatas todavía sin compactar: se cuentan, no se tocan. Si este número
  -- crece mes a mes, el cron de snapshots está fallando.
  SELECT COUNT(*) INTO skip_cnt
  FROM reservations r
  WHERE COALESCE(r.recurrence_end, r.end_time) < _raw_cutoff_ms
    AND NOT EXISTS (
      SELECT 1
      FROM report_snapshots s
      WHERE s.type = 'MONTHLY'
        AND (EXTRACT(EPOCH FROM s.from_date::date) * 1000)::bigint
            <= COALESCE(r.recurrence_end, r.end_time)
        AND (EXTRACT(EPOCH FROM (s.to_date::date + 1)) * 1000)::bigint
            > COALESCE(r.recurrence_end, r.end_time)
    );

  WITH borrables AS (
    SELECT r.id
    FROM reservations r
    WHERE COALESCE(r.recurrence_end, r.end_time) < _raw_cutoff_ms
      AND EXISTS (
        SELECT 1
        FROM report_snapshots s
        WHERE s.type = 'MONTHLY'
          AND (EXTRACT(EPOCH FROM s.from_date::date) * 1000)::bigint
              <= COALESCE(r.recurrence_end, r.end_time)
          AND (EXTRACT(EPOCH FROM (s.to_date::date + 1)) * 1000)::bigint
              > COALESCE(r.recurrence_end, r.end_time)
      )
  )
  DELETE FROM reservations r
  USING borrables b
  WHERE r.id = b.id;
  GET DIAGNOSTICS del_cnt = ROW_COUNT;

  RETURN QUERY SELECT del_cnt, skip_cnt;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Poda de los propios snapshots, pasada la retención de SNAPSHOT_RETENTION_YEARS.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prune_report_snapshots(_cutoff_ms bigint)
RETURNS bigint AS $$
DECLARE
  del_cnt bigint := 0;
BEGIN
  DELETE FROM report_snapshots s
  WHERE (EXTRACT(EPOCH FROM (s.to_date::date + 1)) * 1000)::bigint <= _cutoff_ms;
  GET DIAGNOSTICS del_cnt = ROW_COUNT;
  RETURN del_cnt;
END;
$$ LANGUAGE plpgsql;
