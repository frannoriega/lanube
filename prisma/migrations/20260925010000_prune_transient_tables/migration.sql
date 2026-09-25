-- ============================================================================
-- Milestone 12, segunda pasada — limpieza de tablas transitorias (D28)
--
-- Dos tablas crecían sin techo y sin que nada las limpiara:
--
--   * `verification_tokens`: consumeEmailVerificationToken() devuelve null si el
--     token venció, pero NO borra la fila. Los tokens vencidos quedan para
--     siempre (los de reset de contraseña igual).
--   * `rate_limits`: una fila por (key, endpoint), para siempre. Con el
--     spoofing de cf-connecting-ip arreglado (D13) ya no crece por IP falsa,
--     pero las reales tampoco se van nunca.
--
-- Ninguna de las dos es un dato de negocio: una fila vencida o una ventana de
-- rate limit ya cerrada no le sirve a nadie. Se podan desde el cron diario.
-- ============================================================================

CREATE OR REPLACE FUNCTION prune_transient_rows(_now_ms bigint)
RETURNS TABLE (
  deleted_tokens bigint,
  deleted_rate_limits bigint
) AS $$
DECLARE
  tok_cnt bigint := 0;
  rl_cnt bigint := 0;
  -- Margen sobre el vencimiento, para no borrar una fila que una request en
  -- vuelo todavía podría estar por consumir.
  grace_ms bigint := 86400000; -- 1 día
BEGIN
  DELETE FROM verification_tokens WHERE expires < (_now_ms - grace_ms);
  GET DIAGNOSTICS tok_cnt = ROW_COUNT;

  -- Una fila de rate limit se puede borrar cuando su ventana quedó atrás y no
  -- hay bloqueo vigente. Se usa updatedAt como "último contacto".
  DELETE FROM rate_limits
  WHERE "updatedAt" < (_now_ms - grace_ms)
    AND ("blockedUntil" IS NULL OR "blockedUntil" < _now_ms);
  GET DIAGNOSTICS rl_cnt = ROW_COUNT;

  RETURN QUERY SELECT tok_cnt, rl_cnt;
END;
$$ LANGUAGE plpgsql;
