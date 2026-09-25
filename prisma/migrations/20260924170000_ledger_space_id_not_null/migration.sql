-- ============================================================================
-- Milestone 12, slice G — reservation_ledger.space_id NOT NULL (Parte 4)
--
-- La columna se agregó nullable en 20260706000000_unify_space_resource (tenía que
-- serlo, para que la migración de datos pudiera rellenarla desde el resource_id
-- viejo) y nunca se ajustó después. Prisma siempre la modeló como no nullable
-- (`spaceId String`), así que el esquema y la base discrepaban — se notó mientras
-- se verificaba la foreign key de la slice A.
--
-- Todos los writers la setean (insert_into_ledger la recibe como argumento
-- obligatorio), así que esto solo vuelve real la garantía. El DELETE es una red
-- por si algún backfill histórico dejó una fila sin ella: esa fila es inservible
-- igual, porque toda consulta de capacidad y disponibilidad filtra por space_id.
-- ============================================================================

DELETE FROM reservation_ledger WHERE space_id IS NULL;

ALTER TABLE reservation_ledger ALTER COLUMN space_id SET NOT NULL;
