-- ============================================================================
-- Milestone 12, slice E — los links de una Noticia publicada sobreviven al
-- cambio de slug (D8)
--
-- updateNewsPost() recalculaba el slug cada vez que el enviado difería, sin
-- historial y sin redirect, así que renombrar una nota PUBLISHED dejaba en 404
-- todos los links que ya estaban circulando. Los segmentos de fecha de
-- /news/yyyy/mm/dd/slug ya estaban resueltos (la página de detalle hace 308 al
-- canónico), pero la clave de búsqueda es el slug.
--
-- Contradecía la regla que el propio repo se puso, en CLAUDE.md: "Renombrar una
-- implica agregar un redirect permanente desde la ruta vieja — los links
-- compartidos viven para siempre." La regla se había aplicado a los renombres de
-- rutas (/noticias -> /news) y no a los slugs de contenido que van debajo.
--
-- Una tabla y no una columna array en news_posts, por una razón que importa: el
-- índice UNIQUE de abajo hace que un slug retirado no pueda ser reclamado por una
-- nota futura. Sin eso, la nota B podría tomar el slug viejo de la nota A y el
-- redirect empezaría a apuntar al artículo equivocado.
-- ============================================================================

CREATE TABLE "news_post_slugs" (
    "slug" TEXT NOT NULL,
    "news_post_id" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint,

    CONSTRAINT "news_post_slugs_pkey" PRIMARY KEY ("slug")
);

CREATE INDEX "news_post_slugs_news_post_id_idx" ON "news_post_slugs"("news_post_id");

-- Si se borra la nota, sus slugs retirados se van con ella y vuelven a quedar libres.
ALTER TABLE "news_post_slugs"
  ADD CONSTRAINT "news_post_slugs_news_post_id_fkey"
  FOREIGN KEY ("news_post_id") REFERENCES "news_posts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
