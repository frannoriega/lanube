-- Milestone 35: las reservas ganan un título.
--
-- Hasta ahora una reserva solo tenía `reason` (el «motivo»), que el calendario mostraba como
-- si fuera su nombre. Ahora hay un `title` corto (lo que se ve en el calendario y en las
-- listas) y `reason` pasa a ser la **descripción** opcional. La columna no se renombra: la
-- leen las funciones SQL, el ledger y el historial, y renombrarla no cambia nada para quien
-- usa la app.
--
-- Las reservas existentes toman como título el comienzo de su motivo (primera línea, hasta 80
-- caracteres), así el calendario sigue mostrando lo mismo que mostraba.

ALTER TABLE "reservations" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';

UPDATE "reservations"
SET "title" = left(split_part(btrim("reason"), E'\n', 1), 80)
WHERE "title" = '';
