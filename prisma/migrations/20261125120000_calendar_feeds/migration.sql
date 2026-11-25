-- Milestone 45: suscripciones de calendario (ICS).
--
-- Sin tabla de tokens: cada enlace lleva una firma HMAC (con NEXTAUTH_SECRET) del id de la
-- persona, el feed y esta versión. «Regenerar enlaces» sube la versión; apagar las suscripciones
-- pone `calendar_feed_enabled` en false. Compatible hacia atrás: todo apagado por defecto.
ALTER TABLE "registered_users"
  ADD COLUMN "calendar_feed_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "calendar_feed_version" INTEGER NOT NULL DEFAULT 0;
