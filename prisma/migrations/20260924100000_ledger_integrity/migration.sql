-- ============================================================================
-- Milestone 12, slice A — integridad del ciclo de vida de reservation_ledger
-- (D1, D2, D17)
--
-- El ledger es lo ÚNICO que se consulta para capacidad y disponibilidad (la
-- tabla `reservations` nunca se suma), y sin embargo se creó en
-- 20251015211848_init con una primary key y nada más: sin foreign key a
-- reservations, sin propagación de estado, y sin índice por ninguna de las
-- columnas por las que realmente se filtra.
--
-- Lo que cierra esta migración:
--   D1  Cancelar o rechazar una reserva dejaba sus filas del ledger en APPROVED,
--       así que el espacio seguía ocupado para siempre. maintain_reservations()
--       no lo reparaba: su loop de rebuild solo toma PENDING/APPROVED.
--   D2  Borrar una reserva dejaba sus filas del ledger huérfanas, ocupando el
--       lugar con la evidencia ya borrada.
--   D17 Cada chequeo de capacidad, cada lectura de disponibilidad y el DELETE de
--       cada rebuild eran seq scans de la tabla más grande del esquema.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Purga de huérfanas que dejó cada delete que corrió sin FK.
--    Son irrecuperables (la reserva que describían ya no existe) y están
--    consumiendo capacidad / bloqueando espacios exclusivos.
-- ----------------------------------------------------------------------------
DELETE FROM reservation_ledger l
WHERE NOT EXISTS (
  SELECT 1 FROM reservations r WHERE r.id = l.reservation_id
);

-- ----------------------------------------------------------------------------
-- 2. Resincronizar cada fila sobreviviente con el estado actual de su reserva,
--    reparando la deriva que venía acumulando D1 (el caso dañino es un ledger en
--    APPROVED debajo de una reserva CANCELLED/REJECTED).
-- ----------------------------------------------------------------------------
UPDATE reservation_ledger l
SET status = r.status
FROM reservations r
WHERE r.id = l.reservation_id
  AND l.status <> r.status;

-- ----------------------------------------------------------------------------
-- 3. Integridad referencial. ON DELETE CASCADE hace estructuralmente imposible
--    que una fila del ledger sobreviva a su reserva, sin importar quién haga el
--    delete (Prisma, un DELETE crudo, o el próximo que se agregue).
-- ----------------------------------------------------------------------------
ALTER TABLE reservation_ledger
  ADD CONSTRAINT reservation_ledger_reservation_id_fkey
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- 4. Índices para los caminos que se recorren en cada reserva y cada rebuild.
--    (space_id, status, occurrence_start_time) cubre los predicados de
--    capacidad / exclusividad / disponibilidad; reservation_id cubre el DELETE
--    que abre cada rebuild_reservation_ledger_forward, que
--    maintain_reservations() ejecuta una vez por reserva recurrente por noche.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS reservation_ledger_reservation_id_idx
  ON reservation_ledger (reservation_id);

CREATE INDEX IF NOT EXISTS reservation_ledger_space_status_start_idx
  ON reservation_ledger (space_id, status, occurrence_start_time);

CREATE INDEX IF NOT EXISTS reservation_ledger_occurrence_window_idx
  ON reservation_ledger (occurrence_start_time, occurrence_end_time);

-- ----------------------------------------------------------------------------
-- 5. Propagación de estado.
--
--    Un trigger y no un arreglo en los dos writers de TypeScript, porque la
--    propiedad que se quiere es "el ledger siempre coincide con su reserva" y
--    hoy hay tres writers (setReservationStatus, updateReservation, y las
--    funciones SQL) más los que vengan. Las funciones SQL que ya actualizan
--    ambos siguen siendo correctas: esto es idempotente.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_sync_reservation_ledger_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE reservation_ledger
      SET status = NEW.status
      WHERE reservation_id = NEW.id
        AND status <> NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_reservation_ledger_status ON reservations;
CREATE TRIGGER sync_reservation_ledger_status
  AFTER UPDATE OF status ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_reservation_ledger_status();
