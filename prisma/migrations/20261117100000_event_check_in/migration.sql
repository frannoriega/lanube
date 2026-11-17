-- Milestone 30: check-in en eventos.
--
-- 1. `events.check_in_enabled`: el evento usa check-in en la puerta (opcional, apagado).
-- 2. `event_participants.source`: inscripta por el formulario (REGISTERED) o registrada en la
--    puerta sin inscripción (WALK_IN). Las existentes quedan REGISTERED.
-- 3. `event_check_ins`: un ingreso por inscripción y sesión (inicio nominal). Sin FK a
--    `reservations`: editar los días de un evento borra reservas y eso no debe borrar la
--    asistencia ya registrada.
-- 4. Permiso `events:checkin` para los roles que hoy gestionan eventos (los superadmin lo
--    tienen implícito).

ALTER TABLE "events" ADD COLUMN "check_in_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "participant_sources" AS ENUM ('REGISTERED', 'WALK_IN');

ALTER TABLE "event_participants"
  ADD COLUMN "source" "participant_sources" NOT NULL DEFAULT 'REGISTERED';

CREATE TABLE "event_check_ins" (
  "id" TEXT NOT NULL,
  "participant_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "reservation_id" TEXT NOT NULL,
  "occurrence_start" BIGINT NOT NULL,
  "checked_in_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
  "checked_in_by" TEXT,
  CONSTRAINT "event_check_ins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_check_ins_participant_id_occurrence_start_key"
  ON "event_check_ins"("participant_id", "occurrence_start");
CREATE INDEX "event_check_ins_event_id_occurrence_start_idx"
  ON "event_check_ins"("event_id", "occurrence_start");

ALTER TABLE "event_check_ins"
  ADD CONSTRAINT "event_check_ins_participant_id_fkey"
  FOREIGN KEY ("participant_id") REFERENCES "event_participants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_check_ins"
  ADD CONSTRAINT "event_check_ins_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "roles"
SET "permissions" = array_append("permissions", 'events:checkin')
WHERE 'events:manage' = ANY ("permissions")
  AND NOT ('events:checkin' = ANY ("permissions"));
