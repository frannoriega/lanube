-- ============================================================================
-- Milestone 12, slice G — tamaño de actor y una vista previa de aprobación real
-- (D18, D15)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- D18: un equipo vacío no consumía capacidad alguna.
--
-- get_actor_size() devuelve COUNT(*) de miembros para TEAM / ORGANIZATION. COUNT
-- devuelve 0, no NULL, así que el COALESCE(size, 1) del final nunca atrapaba el
-- caso vacío: un equipo sin miembros reservaba con actor_size 0 y era invisible
-- para toda suma de capacidad, por más reservas que hiciera.
--
-- Se usa GREATEST(..., 1): un actor que ocupa un espacio es al menos un actor.
-- (Si un equipo vacío debería poder reservar es una pregunta de producto; esto
-- solo hace que, cuando reserva, ocupe un lugar.)
-- ----------------------------------------------------------------------------
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
  ELSIF _type = 'EVENT' THEN
    -- Un EVENT ocupa la capacidad completa de su espacio (ver 20260713000000).
    SELECT COALESCE(s.capacity, 1) INTO size
    FROM events e
    JOIN spaces s ON s.id = e.space_id
    WHERE e.id = _id;
  ELSE
    size := 1;
  END IF;

  RETURN GREATEST(COALESCE(size, 1), 1);
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- D15: la vista previa de aprobación era un stub que siempre respondía "nadie".
--
-- previewConflictingPending() en src/lib/db/adminReservations.ts era literalmente
-- `return []`, con el id de la reserva comentado en su único call site. Así que
-- `PATCH /api/admin/reservations/[id]` con `preview: true` siempre le decía al
-- admin "esta aprobación no afecta a nadie" — y después el approve_reservation()
-- real rechazaba reservas de otras personas y les mandaba mail.
--
-- Esto replica los dos loops de cascada de approve_reservation en SOLO LECTURA,
-- con el mismo chequeo de capacidad por rangos (peak_space_usage) que ahora usa
-- el camino de escritura, así la vista previa y la acción no pueden discrepar.
-- Están en el mismo archivo y contiguas a propósito: el modo de falla a evitar es
-- que las dos se separen.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION preview_approval_conflicts(_reservation_id text)
RETURNS TABLE (reservation_id text) AS $$
DECLARE
  res RECORD;
  cap int;
  exclusive boolean;
  used int;
  cand RECORD;
BEGIN
  SELECT r.id, r.space_id, r.reservable_id, r.reservable_type,
         s.capacity, s.is_exclusive
  INTO res
  FROM reservations r
  JOIN spaces s ON s.id = r.space_id
  WHERE r.id = _reservation_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  cap := res.capacity;
  exclusive := res.is_exclusive;

  -- Mismo espacio, solapadas con las ocurrencias de esta reserva.
  FOR cand IN
    SELECT DISTINCT rl.reservation_id AS id
    FROM reservation_ledger rl
    WHERE rl.space_id = res.space_id
      AND rl.status = 'PENDING'
      AND rl.reservation_id <> _reservation_id
      AND EXISTS (
        SELECT 1 FROM reservation_ledger a
        WHERE a.reservation_id = _reservation_id
          AND a.space_id = res.space_id
          AND rl.occurrence_start_time < a.occurrence_end_time
          AND rl.occurrence_end_time > a.occurrence_start_time
      )
  LOOP
    IF exclusive THEN
      RETURN QUERY SELECT cand.id;
    ELSE
      -- Lo que enfrentaría la reserva pendiente una vez aprobada esta. La que
      -- está por aprobarse sigue en PENDING acá, así que su actor_size se suma
      -- explícitamente.
      SELECT COALESCE(MAX(
               peak_space_usage(res.space_id, p.occurrence_start_time,
                                p.occurrence_end_time, cand.id)
               + p.actor_size
               + get_actor_size(res.reservable_type, res.reservable_id)
             ), 0)
      INTO used
      FROM reservation_ledger p
      WHERE p.reservation_id = cand.id
        AND p.status = 'PENDING'
        AND EXISTS (
          SELECT 1 FROM reservation_ledger a
          WHERE a.reservation_id = _reservation_id
            AND a.space_id = res.space_id
            AND p.occurrence_start_time < a.occurrence_end_time
            AND p.occurrence_end_time > a.occurrence_start_time
        );

      IF used > cap THEN
        RETURN QUERY SELECT cand.id;
      END IF;
    END IF;
  END LOOP;

  -- Mismo actor, otro espacio, solapada: siempre se rechaza automáticamente.
  RETURN QUERY
  SELECT DISTINCT rl.reservation_id
  FROM reservation_ledger rl
  WHERE rl.reservable_id   = res.reservable_id
    AND rl.reservable_type = res.reservable_type
    AND rl.status          = 'PENDING'
    AND rl.reservation_id <> _reservation_id
    AND rl.space_id        <> res.space_id
    AND EXISTS (
      SELECT 1 FROM reservation_ledger a
      WHERE a.reservation_id = _reservation_id
        AND rl.occurrence_start_time < a.occurrence_end_time
        AND rl.occurrence_end_time   > a.occurrence_start_time
    );
END;
$$ LANGUAGE plpgsql STABLE;
