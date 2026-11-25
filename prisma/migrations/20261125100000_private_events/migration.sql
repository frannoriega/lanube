-- Milestone 43: eventos privados e invitados.
--
-- Un evento privado no se lista en ninguna superficie pública aunque esté publicado; se llega por
-- el enlace de su formulario. La lista de invitados es opcional: con al menos uno, solo esos
-- emails se pueden inscribir. Compatible hacia atrás: todo evento existente queda público.

ALTER TABLE "events" ADD COLUMN "is_private" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "event_invitees" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_email" TEXT NOT NULL,
    "invited_at" BIGINT,
    "invite_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "event_invitees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_invitees_event_id_email_key" ON "event_invitees"("event_id", "email");

ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
