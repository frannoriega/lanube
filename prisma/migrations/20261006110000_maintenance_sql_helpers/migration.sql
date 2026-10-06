-- ============================================================================
-- Milestone 22 — funciones SQL para manejar el mantenimiento a mano ("botón de
-- emergencia"). Sirven cuando no se puede usar /admin/maintenance (la app no
-- levanta, el login falla, o se está en medio de una migración y solo hay acceso
-- a la base). Uso típico, desde psql:
--
--   SELECT * FROM maintenance_status();                 -- qué hay vigente o programado
--   SELECT maintenance_end_all();                       -- apagar todo
--   SELECT maintenance_end('<id>');                     -- apagar una ventana
--   SELECT maintenance_start('Migración', 'Texto **markdown**', 'READ_ONLY', ARRAY['all']);
--   SELECT maintenance_start('SMTP caído', 'Texto', 'UNAVAILABLE',
--                            ARRAY['signup','password-recovery','event-emails'],
--                            interval '2 hours');       -- con fin previsto a las 2 h
--
-- Notas:
--  - El portero de la app lee las ventanas con una caché de ~15 s por instancia: el
--    cambio no es instantáneo.
--  - Estas funciones NO escriben en la auditoría (audit_logs): quedan solo las filas de
--    maintenance_windows. Es una herramienta de emergencia, no el camino normal.
--  - La base no conoce el catálogo de áreas (vive en src/lib/maintenance/areas.ts): un id
--    de área que no existe se ignora en silencio. Ids vigentes: all, signup,
--    password-recovery, reservations, events, news, event-emails.
-- ============================================================================

-- Ahora, en ms UNIX, con el mismo reloj que usan los DEFAULT de las tablas.
CREATE OR REPLACE FUNCTION maintenance_now_ms() RETURNS bigint AS $$
  SELECT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
$$ LANGUAGE sql STABLE;

-- Ventanas que no terminaron (vigentes o programadas), con su estado y sus fechas legibles.
CREATE OR REPLACE FUNCTION maintenance_status()
RETURNS TABLE (
  id text,
  state text,
  mode text,
  areas text[],
  title text,
  starts_at timestamptz,
  ends_at timestamptz
) AS $$
  SELECT
    w.id,
    CASE WHEN w.starts_at IS NOT NULL AND w.starts_at > maintenance_now_ms()
         THEN 'scheduled' ELSE 'active' END,
    w.mode::text,
    w.areas,
    w.title,
    to_timestamp(w.starts_at / 1000.0),
    to_timestamp(w.ends_at / 1000.0)
  FROM maintenance_windows w
  WHERE w.ended_at IS NULL
    AND (w.ends_at IS NULL OR w.ends_at > maintenance_now_ms())
  ORDER BY w.created_at;
$$ LANGUAGE sql STABLE;

-- Termina una ventana (vigente o programada). Devuelve true si la cortó, false si no
-- existía o ya había terminado.
CREATE OR REPLACE FUNCTION maintenance_end(p_id text) RETURNS boolean AS $$
DECLARE
  n int;
BEGIN
  UPDATE maintenance_windows
     SET ended_at = maintenance_now_ms(), updated_at = maintenance_now_ms()
   WHERE id = p_id
     AND ended_at IS NULL
     AND (ends_at IS NULL OR ends_at > maintenance_now_ms());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$ LANGUAGE plpgsql;

-- Termina todo lo que esté vigente o programado. Devuelve cuántas ventanas cortó.
CREATE OR REPLACE FUNCTION maintenance_end_all() RETURNS int AS $$
DECLARE
  n int;
BEGIN
  UPDATE maintenance_windows
     SET ended_at = maintenance_now_ms(), updated_at = maintenance_now_ms()
   WHERE ended_at IS NULL
     AND (ends_at IS NULL OR ends_at > maintenance_now_ms());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- Declara una ventana que rige desde ya. `p_for` (opcional) es la duración: sin ella queda
-- abierta hasta que se la termine. Aplica las mismas reglas que el panel: título y motivo
-- no vacíos, al menos un área, y «all» no admite UNAVAILABLE. Devuelve el id.
CREATE OR REPLACE FUNCTION maintenance_start(
  p_title text,
  p_reason_md text,
  p_mode text,
  p_areas text[],
  p_for interval DEFAULT NULL
) RETURNS text AS $$
DECLARE
  new_id text := 'sql_' || gen_random_uuid()::text;
BEGIN
  IF coalesce(btrim(p_title), '') = '' THEN
    RAISE EXCEPTION 'maintenance_start: el título es obligatorio';
  END IF;
  IF coalesce(btrim(p_reason_md), '') = '' THEN
    RAISE EXCEPTION 'maintenance_start: el motivo es obligatorio';
  END IF;
  IF p_mode NOT IN ('NOTICE', 'READ_ONLY', 'UNAVAILABLE') THEN
    RAISE EXCEPTION 'maintenance_start: modo inválido "%" (NOTICE, READ_ONLY o UNAVAILABLE)', p_mode;
  END IF;
  IF p_areas IS NULL OR cardinality(p_areas) = 0 THEN
    RAISE EXCEPTION 'maintenance_start: elegí al menos un área';
  END IF;
  IF p_mode = 'UNAVAILABLE' AND 'all' = ANY (p_areas) THEN
    RAISE EXCEPTION 'maintenance_start: "all" solo admite NOTICE o READ_ONLY';
  END IF;

  INSERT INTO maintenance_windows (id, title, reason_md, mode, areas, ends_at)
  VALUES (
    new_id,
    btrim(p_title),
    btrim(p_reason_md),
    p_mode::maintenance_modes,
    p_areas,
    CASE WHEN p_for IS NULL THEN NULL
         ELSE maintenance_now_ms() + (EXTRACT(EPOCH FROM p_for) * 1000)::bigint END
  );
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;
