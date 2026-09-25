-- ============================================================================
-- Milestone 12, slice D — que el cron diario deje de destruir el historial de
-- reservas (D7)
--
-- maintain_reservations() ejecutaba dos hard deletes contra `reservations`:
--
--   DELETE FROM reservations WHERE is_recurring = false AND end_time < hoy;
--   DELETE FROM reservations WHERE is_recurring = true
--     AND NOT recurring_reservation_has_occurrence_after(id, hoy);
--
-- así que cada reserva pasada se borraba a la mañana siguiente. Eso es podar el
-- registro de DOMINIO, no la tabla derivada que el cron existe para mantener.
-- Consecuencias:
--
--   * /admin/reports arma cada reporte de uso desde prisma.reservation sobre un
--     rango de fechas (adminReports.ts fetchRangeData). Cualquier reporte de un
--     período pasado volvía casi vacío: no estaba un poco mal, era
--     estructuralmente incapaz de reportar historial.
--   * check_ins.reservation_id es ON DELETE SET NULL, así que los registros de
--     ingreso quedaban silenciosamente desvinculados de la reserva que los
--     justificaba.
--   * las entradas de audit_logs con entityType='Reservation' apuntaban a ids
--     que ya no resolvían.
--
-- Nada dependía del borrado. El propósito declarado del cron — mantener las
-- reservas recurrentes materializadas hacia adelante — lo cumple enteramente el
-- rebuild del ledger, que se conserva sin cambios.
--
-- El ledger (derivado, reconstruible, y por lejos la tabla más grande) se sigue
-- podando; esa es la parte que realmente hay que mantener chica.
-- ============================================================================

-- Cambia la firma de retorno (la tercera columna ya no cuenta reservas
-- borradas), así que la función vieja tiene que irse primero.
DROP FUNCTION IF EXISTS maintain_reservations();

CREATE OR REPLACE FUNCTION maintain_reservations()
RETURNS TABLE (
  deleted_past_ledger bigint,
  rebuilt_recurring bigint,
  pruned_expired_ledger bigint
) AS $$
DECLARE
  today_start_ms bigint;
  del_cnt bigint;
  reb_cnt int := 0;
  pruned_cnt bigint := 0;
  rec RECORD;
BEGIN
  today_start_ms := (EXTRACT(EPOCH FROM date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') * 1000)::bigint;

  -- 1. Borrar los buckets del ledger que quedaron enteramente en el pasado. Son
  --    datos derivados: las reservas de las que salieron se conservan.
  DELETE FROM reservation_ledger WHERE occurrence_end_time < today_start_ms;
  GET DIAGNOSTICS del_cnt = ROW_COUNT;

  -- 2. Rematerializar hacia adelante cada reserva recurrente viva. Esta es la
  --    mitad crítica del cron: si no corre, las recurrentes dejan de expandirse
  --    y los chequeos de conflicto empiezan a pasar en silencio.
  FOR rec IN
    SELECT id FROM reservations
    WHERE is_recurring = true
      AND rrule IS NOT NULL
      AND space_id IS NOT NULL
      AND status IN ('PENDING', 'APPROVED')
  LOOP
    PERFORM rebuild_reservation_ledger_forward(rec.id);
    reb_cnt := reb_cnt + 1;
  END LOOP;

  -- 3. Podar las filas de ledger que quedaron de reservas que ya no pueden
  --    ocurrir: una reserva única terminada, o una serie recurrente sin
  --    ocurrencias restantes. Las reservas en sí se CONSERVAN — esto solo limpia
  --    las filas derivadas que si no seguirían ocupando lugar en los chequeos de
  --    capacidad sin motivo. (El estado se mantiene correcto vía
  --    sync_reservation_ledger_status.)
  DELETE FROM reservation_ledger l
  WHERE EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.id = l.reservation_id
      AND (
        (r.is_recurring = false AND r.end_time < today_start_ms)
        OR (r.is_recurring = true AND r.rrule IS NOT NULL
            AND NOT recurring_reservation_has_occurrence_after(r.id, today_start_ms))
      )
  );
  GET DIAGNOSTICS pruned_cnt = ROW_COUNT;

  RETURN QUERY SELECT del_cnt, reb_cnt::bigint, pruned_cnt;
END;
$$ LANGUAGE plpgsql;
