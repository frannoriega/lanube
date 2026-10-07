-- Milestone 25, S5: los enlaces de edición de una inscripción se guardan hasheados.
--
-- Antes `event_participants.edit_token` guardaba el token en claro: una fuga de la base daba
-- acceso a editar o cancelar toda inscripción. Ahora cada inscripción tiene N tokens en
-- `event_participant_edit_tokens`, de los que solo se guarda el SHA-256. Cada correo que lleva
-- enlace emite uno nuevo y los anteriores siguen valiendo (no se rota: rotar rompía el enlace del
-- correo de inscripción con cada cambio de sesión). Todos vencen cuando termina el evento; eso
-- se calcula al usarlos (ver `src/lib/events/edit-token.ts`), no se guarda acá.

CREATE TABLE "event_participant_edit_tokens" (
  "id" TEXT NOT NULL,
  "participant_id" TEXT NOT NULL,
  -- SHA-256 en hex del token. El token en sí nunca se guarda.
  "token_hash" TEXT NOT NULL,
  "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
  CONSTRAINT "event_participant_edit_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_participant_edit_tokens_token_hash_key"
  ON "event_participant_edit_tokens"("token_hash");
CREATE INDEX "event_participant_edit_tokens_participant_id_idx"
  ON "event_participant_edit_tokens"("participant_id");

ALTER TABLE "event_participant_edit_tokens"
  ADD CONSTRAINT "event_participant_edit_tokens_participant_id_fkey"
  FOREIGN KEY ("participant_id") REFERENCES "event_participants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Los tokens que ya existían pasan hasheados (mismo SHA-256 hex que `hashEditToken()` en JS),
-- así los enlaces ya enviados siguen andando: la búsqueda hashea lo que llega. El id reutiliza
-- el del participante con un prefijo, para no depender de una función de cuid en SQL.
INSERT INTO "event_participant_edit_tokens" ("id", "participant_id", "token_hash", "created_at")
SELECT 'legacy_' || "id",
       "id",
       encode(sha256(convert_to("edit_token", 'UTF8')), 'hex'),
       "created_at"
FROM "event_participants";

-- El token en claro desaparece de la base.
DROP INDEX "event_participants_edit_token_key";
ALTER TABLE "event_participants" DROP COLUMN "edit_token";
