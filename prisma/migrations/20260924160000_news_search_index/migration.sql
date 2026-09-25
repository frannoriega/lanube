-- ============================================================================
-- Milestone 12, slice G — búsqueda full-text de Noticias: null-safety + índice
-- (Parte 4)
--
-- searchPublishedNews() armaba su tsvector como
--   to_tsvector('spanish', title || ' ' || summary || ' ' || body)
-- Dos problemas:
--   1. `||` devuelve NULL si algún operando es NULL, así que una sola columna en
--      null habría sacado la nota de todos los resultados de búsqueda en
--      silencio, en lugar de dar error. Hoy summary/body son NOT NULL, así que
--      estaba latente.
--   2. Nada lo indexaba, así que cada búsqueda pública escaneaba news_posts
--      secuencialmente y recalculaba to_tsvector fila por fila.
--
-- Un helper IMMUTABLE resuelve las dos cosas: hace la expresión null-safe Y la
-- hace indexable. Además mantiene la consulta de la app y la definición del
-- índice textualmente idénticas — si se separan, el índice deja de usarse en
-- silencio.
-- ============================================================================

CREATE OR REPLACE FUNCTION news_search_text(
  _title text,
  _summary text,
  _body text
) RETURNS text AS $$
  SELECT COALESCE(_title, '') || ' ' ||
         COALESCE(_summary, '') || ' ' ||
         COALESCE(_body, '');
$$ LANGUAGE sql IMMUTABLE;

CREATE INDEX news_posts_search_idx
  ON news_posts
  USING GIN (to_tsvector('spanish', news_search_text(title, summary, body)));
