-- Milestone 34: integrantes de una inscripción y check-in por integrante.
--
-- Una inscripción (`event_participants`) puede ser de un equipo: quien inscribe + integrantes
-- cargados con campos «Participante». Cada persona se materializa en `event_participant_members`
-- (buscar y hacer check-in sin recorrer el JSON de respuestas). El cupo sigue contando
-- inscripciones, no integrantes.
--
-- Compatible hacia atrás: cada inscripción existente recibe su integrante PRIMARY (su email), y
-- los check-ins existentes pasan a ese integrante. El id del PRIMARY migrado es determinista
-- ('pm_' || id de la inscripción) para poder enlazar los check-ins en el mismo script.

CREATE TABLE "event_participant_members" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_email" TEXT NOT NULL,
    "label" TEXT,
    "node_path" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
    "updated_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "event_participant_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "event_participant_members_role_check" CHECK ("role" IN ('PRIMARY', 'MEMBER'))
);

CREATE UNIQUE INDEX "event_participant_members_participant_id_email_key"
    ON "event_participant_members"("participant_id", "email");
CREATE INDEX "event_participant_members_event_id_email_idx"
    ON "event_participant_members"("event_id", "email");

ALTER TABLE "event_participant_members" ADD CONSTRAINT "event_participant_members_participant_id_fkey"
    FOREIGN KEY ("participant_id") REFERENCES "event_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_participant_members" ADD CONSTRAINT "event_participant_members_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un PRIMARY por cada inscripción existente.
INSERT INTO "event_participant_members"
    ("id", "participant_id", "event_id", "role", "email", "display_email", "position")
SELECT 'pm_' || p."id", p."id", p."event_id", 'PRIMARY', p."email",
       COALESCE(p."display_email", p."email"), 0
FROM "event_participants" p;

-- Check-in por integrante: los existentes pasan al PRIMARY de su inscripción.
ALTER TABLE "event_check_ins" ADD COLUMN "member_id" TEXT;
UPDATE "event_check_ins" SET "member_id" = 'pm_' || "participant_id";
ALTER TABLE "event_check_ins" ALTER COLUMN "member_id" SET NOT NULL;
ALTER TABLE "event_check_ins" ADD CONSTRAINT "event_check_ins_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "event_participant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "event_check_ins_participant_id_occurrence_start_key";
CREATE UNIQUE INDEX "event_check_ins_member_id_occurrence_start_key"
    ON "event_check_ins"("member_id", "occurrence_start");
CREATE INDEX "event_check_ins_participant_id_idx" ON "event_check_ins"("participant_id");
