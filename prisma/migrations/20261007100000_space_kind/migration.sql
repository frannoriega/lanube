-- ============================================================================
-- Milestone 24 — áreas comunes («amenities») junto a los espacios.
--
-- Un `Space` pasa a tener `kind`: SPACE (se reserva, alberga eventos) o AMENITY (solo se
-- muestra: cocina, jardín, living). Las filas existentes quedan como SPACE (default), así
-- que no hace falta backfill.
--
-- `capacity` pasa a ser nullable: una amenity puede no tener capacidad. Es seguro para las
-- funciones SQL de reservas: `create_reservation()` ya rechaza un espacio con `cap IS NULL`
-- («No available resource…»), y una amenity nunca tiene reservas ni eventos (CHECK abajo +
-- validación en `createEvent`/`updateEvent`).
-- ============================================================================
CREATE TYPE "space_kinds" AS ENUM ('SPACE', 'AMENITY');

ALTER TABLE "spaces" ADD COLUMN "kind" "space_kinds" NOT NULL DEFAULT 'SPACE';
ALTER TABLE "spaces" ALTER COLUMN "capacity" DROP NOT NULL;

-- Un SPACE siempre tiene capacidad; una AMENITY nunca se reserva ni es exclusiva.
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_kind_invariants" CHECK (
  (kind = 'SPACE' AND capacity IS NOT NULL)
  OR (kind = 'AMENITY' AND NOT is_reservable AND NOT is_exclusive)
);

CREATE INDEX "spaces_kind_display_order_idx" ON "spaces"("kind", "display_order");

-- Una AMENITY no puede tener reservas ni eventos. Se exige en la base (y no solo en los
-- formularios) por el mismo motivo que el resto de las reglas de reservas: hay varios
-- caminos de escritura (web, panel, conector MCP) y ninguno debe poder saltearla.
CREATE OR REPLACE FUNCTION reject_amenity_space() RETURNS trigger AS $$
BEGIN
  IF NEW.space_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM spaces WHERE id = NEW.space_id AND kind = 'AMENITY'
  ) THEN
    RAISE EXCEPTION 'Un área común no se puede reservar ni usar para eventos';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservations_reject_amenity
  BEFORE INSERT OR UPDATE OF space_id ON reservations
  FOR EACH ROW EXECUTE FUNCTION reject_amenity_space();

CREATE TRIGGER events_reject_amenity
  BEFORE INSERT OR UPDATE OF space_id ON events
  FOR EACH ROW EXECUTE FUNCTION reject_amenity_space();

-- Y al revés: un espacio que ya tiene reservas o eventos no puede pasar a AMENITY.
CREATE OR REPLACE FUNCTION reject_amenity_if_in_use() RETURNS trigger AS $$
BEGIN
  IF NEW.kind = 'AMENITY' AND OLD.kind <> 'AMENITY' AND (
    EXISTS (SELECT 1 FROM reservations WHERE space_id = NEW.id)
    OR EXISTS (SELECT 1 FROM events WHERE space_id = NEW.id)
  ) THEN
    RAISE EXCEPTION 'El espacio tiene reservas o eventos y no puede ser un área común';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER spaces_reject_amenity_if_in_use
  BEFORE UPDATE OF kind ON spaces
  FOR EACH ROW EXECUTE FUNCTION reject_amenity_if_in_use();
