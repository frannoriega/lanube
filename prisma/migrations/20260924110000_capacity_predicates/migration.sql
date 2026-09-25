-- ============================================================================
-- Milestone 12, slice B — corrección de los predicados de capacidad (D3, D4, D5)
--
-- Tres defectos independientes en los predicados que deciden "¿está libre este
-- espacio?". Se venían tapando entre ellos: D4 bloquea de menos en el camino de
-- escritura y D5 bloquea de más en el de lectura, así que el calendario se veía
-- conservadoramente lleno y nadie intentaba la reserva que habría expuesto D4.
--
--   D4  Toda suma de capacidad cruzaba el ledger con
--         l.occurrence_start_time = gs
--       donde gs venía de generate_series(_start_ms, ...). Los buckets del
--       ledger se escriben desde el inicio PROPIO de cada reserva, no desde una
--       grilla compartida, así que la igualdad solo coincidía si todas las
--       reservas del espacio empezaban en el mismo múltiplo de 15 minutos desde
--       epoch. Nada lo exigía (la API de reservas recibe ms crudos del cliente;
--       los horarios de eventos aceptaban cualquier HH:mm). Cuando las grillas
--       difieren la suma es 0 en todos los buckets y el chequeo no falla: pasa
--       vacuamente, por más lleno que esté el espacio.
--       Se corrige comparando RANGOS: una fila del ledger cuenta contra un
--       bucket cuando se solapa con él. Correcto sin importar la alineación.
--
--   D5  get_unavailable_slots sumaba con un frame de
--         RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
--       que vuelve inerte al ORDER BY y hace que el frame sea la partición
--       ENTERA — o sea, el total reservado en cualquier punto de la ventana
--       pedida, no por slot. Una persona reservando 5h en un espacio de
--       capacidad 20 marcaba la semana completa como no disponible. Se corrige
--       particionando por occurrence_start_time.
--
--   D3  approve_reservation promovía la fila a APPROVED sin condiciones y solo
--       después miraba las OTRAS filas pendientes. Todo lo que hubiera ocupado
--       el lugar entre la creación y la aprobación (un evento nuevo, otra
--       aprobación, una capacidad reducida) era invisible, así que aprobar podía
--       fabricar un sobrecupo o una doble reserva reales. Se corrige con una
--       precondición, más abajo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper compartido: ocupación pico de un espacio en una ventana, en unidades
-- de actor.
--
-- Recorre la ventana en buckets de 15 minutos y devuelve el total más alto de
-- actor_size APPROVED que se solapa con algún bucket. Compara rangos, así que es
-- correcto sin importar si las filas del ledger comparten nuestra grilla (D4).
-- `_exclude` permite que quien llama deje su propia reserva afuera del chequeo.
--
-- El GROUP BY interno no es decorativo: cuando el bucket de sondeo no está
-- alineado con la grilla del ledger, se solapa con DOS buckets contiguos de la
-- misma reserva, y sumar filas contaría dos veces su actor_size. Contar una vez
-- cada RESERVA solapada es lo que realmente significa "cuántos actores hay en la
-- sala durante este bucket".
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION peak_space_usage(
  _space_id text,
  _win_s bigint,
  _win_e bigint,
  _exclude_reservation_id text DEFAULT NULL
) RETURNS int AS $$
  SELECT COALESCE(MAX(slot_sum), 0)::int
  FROM (
    SELECT COALESCE((
             SELECT SUM(per_reservation.actor_size)
             FROM (
               SELECT l.reservation_id, MAX(l.actor_size) AS actor_size
               FROM reservation_ledger l
               WHERE l.space_id = _space_id
                 AND l.status = 'APPROVED'
                 AND (_exclude_reservation_id IS NULL
                      OR l.reservation_id <> _exclude_reservation_id)
                 AND l.occurrence_start_time < gs + 900000
                 AND l.occurrence_end_time   > gs
               GROUP BY l.reservation_id
             ) per_reservation
           ), 0) AS slot_sum
    FROM generate_series(_win_s, _win_e - 1, 900000::bigint) AS gs
  ) slot_check;
$$ LANGUAGE sql STABLE;

-- ----------------------------------------------------------------------------
-- Helper compartido: ¿ya hay una reserva APPROVED solapada con esta ventana?
-- Para espacios exclusivos, donde una reserva es una reserva.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION space_window_is_taken(
  _space_id text,
  _win_s bigint,
  _win_e bigint,
  _exclude_reservation_id text DEFAULT NULL
) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM reservation_ledger l
    WHERE l.space_id = _space_id
      AND l.status = 'APPROVED'
      AND (_exclude_reservation_id IS NULL
           OR l.reservation_id <> _exclude_reservation_id)
      AND l.occurrence_start_time < _win_e
      AND l.occurrence_end_time   > _win_s
  );
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- create_reservation — misma firma y mismo comportamiento; las sumas de
-- capacidad pasan a peak_space_usage() / space_window_is_taken() (D4).
-- ============================================================================
CREATE OR REPLACE FUNCTION create_reservation(
  _reservation_id text,
  _reservable_type reservable_types,
  _reservable_id text,
  _space_id text,
  _event_type text,
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
  conflict_space_name text;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  duration_ms := _end_ms - _start_ms;
  IF duration_ms <= 0 THEN
    RAISE EXCEPTION 'Invalid reservation window';
  END IF;

  year_cap_ms := 365::bigint * 86400000;

  SELECT get_actor_size(_reservable_type, _reservable_id) INTO actor_size;

  SELECT capacity, is_exclusive
  INTO cap, exclusive
  FROM spaces
  WHERE id = _space_id;

  IF cap IS NULL THEN
    RAISE EXCEPTION 'No available resource for the given time window';
  END IF;

  IF NOT _is_recurring THEN
    IF exclusive THEN
      IF space_window_is_taken(_space_id, _start_ms, _end_ms) THEN
        RAISE EXCEPTION 'No available resource for the given time window';
      END IF;
    ELSE
      overlap := peak_space_usage(_space_id, _start_ms, _end_ms);
      IF (overlap + actor_size) > cap THEN
        RAISE EXCEPTION 'No available resource for the given time window';
      END IF;
    END IF;

    -- Guarda de solapamiento entre espacios
    SELECT s.name
    INTO conflict_space_name
    FROM reservation_ledger l
    JOIN spaces s ON s.id = l.space_id
    WHERE l.reservable_id   = _reservable_id
      AND l.reservable_type = _reservable_type
      AND l.status          = 'APPROVED'
      AND l.space_id        <> _space_id
      AND l.occurrence_start_time < _end_ms
      AND l.occurrence_end_time   > _start_ms
    LIMIT 1;
    IF conflict_space_name IS NOT NULL THEN
      RAISE EXCEPTION 'Overlap with approved reservation at %', conflict_space_name;
    END IF;

    INSERT INTO reservations (
      id, reservable_type, reservable_id, space_id,
      event_type, reason, start_time, end_time,
      is_recurring, rrule, recurrence_end, status,
      created_at, updated_at
    )
    VALUES (
      _reservation_id, _reservable_type, _reservable_id, _space_id,
      _event_type, _reason, _start_ms, _end_ms,
      false, NULL, NULL, 'PENDING',
      now_ms, now_ms
    );

    PERFORM insert_into_ledger(_reservation_id, _start_ms, _end_ms, _reservable_type, _reservable_id, _space_id, _event_type, _reason, actor_size, 'PENDING');

    RETURN;
  END IF;

  -- Camino recurrente
  INSERT INTO reservations (
    id, reservable_type, reservable_id, space_id,
    event_type, reason, start_time, end_time,
    is_recurring, rrule, recurrence_end, status,
    created_at, updated_at
  )
  VALUES (
    _reservation_id, _reservable_type, _reservable_id, _space_id,
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
        IF space_window_is_taken(_space_id, win_s, win_e) THEN
          RAISE EXCEPTION 'Conflict on %', occ_ms;
        END IF;
      ELSE
        overlap := peak_space_usage(_space_id, win_s, win_e);
        IF (overlap + actor_size) > cap THEN
          RAISE EXCEPTION 'Capacity exceeded on %', occ_ms;
        END IF;
      END IF;

      -- Guarda de solapamiento entre espacios, por ocurrencia
      SELECT s.name
      INTO conflict_space_name
      FROM reservation_ledger l
      JOIN spaces s ON s.id = l.space_id
      WHERE l.reservable_id   = _reservable_id
        AND l.reservable_type = _reservable_type
        AND l.status          = 'APPROVED'
        AND l.space_id        <> _space_id
        AND l.occurrence_start_time < win_e
        AND l.occurrence_end_time   > win_s
      LIMIT 1;
      IF conflict_space_name IS NOT NULL THEN
        RAISE EXCEPTION 'Overlap with approved reservation at % on occurrence %', conflict_space_name, occ_ms;
      END IF;

      PERFORM insert_into_ledger(_reservation_id, win_s, win_e, _reservable_type, _reservable_id, _space_id, _event_type, _reason, actor_size, 'PENDING');
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
-- reservation_window_conflicts — la guarda de reprogramación. Mismo defecto de
-- igualdad, misma corrección.
-- ============================================================================
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
  IF NOT FOUND OR r.space_id IS NULL OR _win_e <= _win_s THEN
    RETURN false;
  END IF;

  SELECT capacity, is_exclusive
  INTO cap, exclusive
  FROM spaces
  WHERE id = r.space_id;

  SELECT get_actor_size(r.reservable_type, r.reservable_id) INTO actor_size;

  IF exclusive THEN
    RETURN space_window_is_taken(r.space_id, _win_s, _win_e, _reservation_id);
  END IF;

  overlap := peak_space_usage(r.space_id, _win_s, _win_e, _reservation_id);
  RETURN (overlap + actor_size) > cap;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- get_unavailable_slots — ocupación por slot en lugar de un total por ventana.
--
-- El frame de la window function ahora es el conjunto de filas del ledger que
-- comparten occurrence_start_time, que es lo que significa "este slot está
-- lleno". Las filas desalineadas (la causa de D4) siguen reportando su propio
-- bucket; ya no pueden borrar el rango pedido completo.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_unavailable_slots(
  _space_id text,
  _from_ms bigint,
  _to_ms bigint,
  _exclude_user_id text DEFAULT NULL
)
RETURNS TABLE (
  space_id text,
  start_time bigint,
  end_time bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH ledger_data AS (
    SELECT
      l.space_id,
      s.capacity,
      s.is_exclusive,
      l.occurrence_start_time,
      l.occurrence_end_time,
      SUM(l.actor_size) OVER (
        PARTITION BY l.space_id, l.occurrence_start_time
      ) AS total_used
    FROM reservation_ledger l
    JOIN spaces s ON s.id = l.space_id
    WHERE l.space_id = _space_id
      AND l.status = 'APPROVED'
      AND l.occurrence_start_time < _to_ms
      AND l.occurrence_end_time > _from_ms
      AND (_exclude_user_id IS NULL OR l.reservable_id != _exclude_user_id)
  )
  SELECT DISTINCT
    l.space_id,
    occurrence_start_time AS start_time,
    occurrence_end_time AS end_time
  FROM ledger_data l
  WHERE
    (is_exclusive = true)
    OR (total_used >= capacity)
  ORDER BY start_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- approve_reservation — se agrega una precondición (D3).
--
-- Antes de promover nada, cada ocurrencia de la reserva que se está aprobando se
-- vuelve a chequear contra el espacio tal como está AHORA, excluyendo las filas
-- propias de la reserva (todavía en PENDING). Levantar excepción aborta la
-- sentencia, así que una aprobación rechazada no deja estado parcial. La cascada
-- que sigue no cambia.
-- ============================================================================
CREATE OR REPLACE FUNCTION approve_reservation(_reservation_id text)
RETURNS TABLE(approved_id text, auto_rejected_ids text) AS $$
DECLARE
  res RECORD;
  cap int;
  exclusive boolean;
  used int;
  overlap RECORD;
  occ RECORD;
  rejected_ids text[];
  now_ms bigint;
  actor_size int;
  conflict_space_name text;
BEGIN
  now_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
  rejected_ids := ARRAY[]::text[];

  SELECT r.id AS reservation_id,
         r.space_id,
         r.reservable_id,
         r.reservable_type,
         r.start_time,
         r.end_time,
         s.capacity,
         s.is_exclusive
  INTO res
  FROM reservations r
  JOIN spaces s ON s.id = r.space_id
  WHERE r.id = _reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation % not found', _reservation_id;
  END IF;

  cap := res.capacity;
  exclusive := res.is_exclusive;
  SELECT get_actor_size(res.reservable_type, res.reservable_id) INTO actor_size;

  -- ---- Precondición: ¿esta reserva todavía entra? (D3) --------------------
  -- Sus propias filas del ledger son las ocurrencias a chequear; se las excluye
  -- de la ocupación contra la que se comparan.
  FOR occ IN
    SELECT DISTINCT l.occurrence_start_time AS s_ms, l.occurrence_end_time AS e_ms
    FROM reservation_ledger l
    WHERE l.reservation_id = _reservation_id
  LOOP
    IF exclusive THEN
      IF space_window_is_taken(res.space_id, occ.s_ms, occ.e_ms, _reservation_id) THEN
        RAISE EXCEPTION 'Approval conflict: space taken at %', occ.s_ms;
      END IF;
    ELSE
      used := peak_space_usage(res.space_id, occ.s_ms, occ.e_ms, _reservation_id);
      IF (used + actor_size) > cap THEN
        RAISE EXCEPTION 'Approval conflict: capacity exceeded at %', occ.s_ms;
      END IF;
    END IF;

    -- El mismo actor no puede terminar aprobado en dos lugares a la vez.
    SELECT s.name
    INTO conflict_space_name
    FROM reservation_ledger l
    JOIN spaces s ON s.id = l.space_id
    WHERE l.reservable_id   = res.reservable_id
      AND l.reservable_type = res.reservable_type
      AND l.status          = 'APPROVED'
      AND l.reservation_id <> _reservation_id
      AND l.space_id        <> res.space_id
      AND l.occurrence_start_time < occ.e_ms
      AND l.occurrence_end_time   > occ.s_ms
    LIMIT 1;
    IF conflict_space_name IS NOT NULL THEN
      RAISE EXCEPTION 'Approval conflict: actor already approved at %', conflict_space_name;
    END IF;
  END LOOP;
  -- ------------------------------------------------------------------------

  UPDATE reservations
    SET status = 'APPROVED', updated_at = now_ms
    WHERE id = _reservation_id;

  UPDATE reservation_ledger
    SET status = 'APPROVED'
    WHERE reservation_id = _reservation_id;

  -- Rechazo automático de las reservas PENDING en conflicto en el mismo espacio
  FOR overlap IN
    SELECT DISTINCT rl.reservation_id
    FROM reservation_ledger rl
    WHERE rl.space_id = res.space_id
      AND rl.status = 'PENDING'
      AND rl.reservation_id <> _reservation_id
      AND EXISTS (
        SELECT 1
        FROM reservation_ledger a
        WHERE a.reservation_id = _reservation_id
          AND a.space_id = res.space_id
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
      -- Ocupación pico que enfrentaría la reserva pendiente, por sus propias
      -- ocurrencias, más lo que ella misma sumaría. Basado en rangos (D4).
      SELECT COALESCE(MAX(
               peak_space_usage(res.space_id, p.occurrence_start_time, p.occurrence_end_time,
                                overlap.reservation_id)
               + p.actor_size
             ), 0)
      INTO used
      FROM reservation_ledger p
      WHERE p.reservation_id = overlap.reservation_id
        AND p.status = 'PENDING'
        AND EXISTS (
          SELECT 1
          FROM reservation_ledger a
          WHERE a.reservation_id = _reservation_id
            AND a.status = 'APPROVED'
            AND a.space_id = res.space_id
            AND p.occurrence_start_time < a.occurrence_end_time
            AND p.occurrence_end_time > a.occurrence_start_time
        );

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

  -- Rechazo automático de las reservas PENDING del mismo reservable en otro espacio
  -- que se solapen con la que se acaba de aprobar (conflicto entre espacios).
  FOR overlap IN
    SELECT DISTINCT rl.reservation_id
    FROM reservation_ledger rl
    WHERE rl.reservable_id   = res.reservable_id
      AND rl.reservable_type = res.reservable_type
      AND rl.status          = 'PENDING'
      AND rl.reservation_id <> _reservation_id
      AND rl.space_id        <> res.space_id
      AND EXISTS (
        SELECT 1
        FROM reservation_ledger a
        WHERE a.reservation_id = _reservation_id
          AND a.status         = 'APPROVED'
          AND rl.occurrence_start_time < a.occurrence_end_time
          AND rl.occurrence_end_time   > a.occurrence_start_time
      )
  LOOP
    UPDATE reservations SET status = 'REJECTED', updated_at = now_ms
      WHERE id = overlap.reservation_id;
    UPDATE reservation_ledger SET status = 'REJECTED'
      WHERE reservation_id = overlap.reservation_id;
    rejected_ids := array_append(rejected_ids, overlap.reservation_id);
  END LOOP;

  RETURN QUERY SELECT _reservation_id, array_to_string(rejected_ids, ',');
END;
$$ LANGUAGE plpgsql;
