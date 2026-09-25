-- ============================================================================
-- Milestone 12, slice E — un Comunicador puede corregir su propia Noticia
-- publicada sin bajarla del sitio (D20)
--
-- Antes de esto, editar una nota publicada no tenía ningún resultado seguro:
-- enviar PUBLISHED chocaba con el 403 de assertAuthorTransition, y enviar DRAFT o
-- PENDING_REVIEW guardaba la edición pero sacaba el artículo del sitio hasta que
-- un admin lo volviera a aprobar. Corregir un typo costaba la disponibilidad de
-- la página, y nada avisaba que iba a pasar.
--
-- Resuelto (2026-09-24) como "corregir en el lugar + marcar para revisión": la
-- nota sigue PUBLISHED y en línea, y queda marcada para que un admin revise el
-- cambio después. La supervisión pasa a ser posterior en lugar de bloqueante, que
-- es el intercambio que vale la velocidad de corrección.
--
-- La marca la pone solo un autor con `news:manage` a secas. Si el que edita es un
-- admin (tiene `news:approve`), su edición ES la revisión, así que no hay nada
-- que encolar.
-- ============================================================================

ALTER TABLE "news_posts"
  ADD COLUMN "needs_review" BOOLEAN NOT NULL DEFAULT false;

-- Índice común (no parcial), a propósito: tiene que coincidir exactamente con el
-- @@index de prisma/models/news.prisma. Este repo ya tiene un lugar donde una
-- migración escrita a mano y el esquema de Prisma discrepan (la FK polimórfica
-- reservable_id que se eliminó, y que `prisma migrate dev` insiste en volver a
-- agregar — ver CLAUDE.md); agregar una segunda fuente de esa deriva no vale la
-- selectividad marginal de un índice parcial en una tabla de este tamaño.
CREATE INDEX "news_posts_needs_review_idx"
  ON "news_posts" ("needs_review");
