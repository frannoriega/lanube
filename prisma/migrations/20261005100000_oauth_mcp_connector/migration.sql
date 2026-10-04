-- ============================================================================
-- Milestone 20 — conector MCP: servidor OAuth 2.1 mínimo (ver prisma/models/oauth.prisma)
-- y la marca de origen de las reservas pedidas por un asistente.
--
-- ⚠️ Escrita a mano a partir de `prisma migrate diff`: el diff contra la base trae además
-- ruido ajeno (defaults, re-agregar la FK polimórfica `reservations_reservable_id_fkey`, que
-- se dropeó a propósito en 20260622000000) y se descartó.
-- ============================================================================

CREATE TYPE "OAuthClientKind" AS ENUM ('DCR', 'CIMD');
CREATE TYPE "ReservationOrigin" AS ENUM ('WEB', 'ASSISTANT');

ALTER TABLE "reservations"
    ADD COLUMN "origin" "ReservationOrigin" NOT NULL DEFAULT 'WEB',
    ADD COLUMN "origin_client_name" TEXT;

CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "kind" "OAuthClientKind" NOT NULL,
    "name" TEXT NOT NULL,
    "redirect_uris" TEXT[],
    "logo_uri" TEXT,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
    "metadata_fetched_at" BIGINT,
    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_grants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "scopes" TEXT[],
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
    "last_used_at" BIGINT,
    "revoked_at" BIGINT,
    CONSTRAINT "oauth_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_authorization_codes" (
    "code_hash" TEXT NOT NULL,
    "grant_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "code_challenge" TEXT NOT NULL,
    "scopes" TEXT[],
    "resource" TEXT NOT NULL,
    "expires_at" BIGINT NOT NULL,
    "used_at" BIGINT,
    CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("code_hash")
);

CREATE TABLE "oauth_tokens" (
    "id" TEXT NOT NULL,
    "grant_id" TEXT NOT NULL,
    "access_token_hash" TEXT NOT NULL,
    "refresh_token_hash" TEXT,
    "scopes" TEXT[],
    "resource" TEXT NOT NULL,
    "access_expires_at" BIGINT NOT NULL,
    "refresh_expires_at" BIGINT,
    "replaced_by_id" TEXT,
    "revoked_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_clients_client_id_key" ON "oauth_clients"("client_id");
CREATE INDEX "oauth_grants_user_id_idx" ON "oauth_grants"("user_id");
CREATE INDEX "oauth_authorization_codes_expires_at_idx" ON "oauth_authorization_codes"("expires_at");
CREATE UNIQUE INDEX "oauth_tokens_access_token_hash_key" ON "oauth_tokens"("access_token_hash");
CREATE UNIQUE INDEX "oauth_tokens_refresh_token_hash_key" ON "oauth_tokens"("refresh_token_hash");
CREATE INDEX "oauth_tokens_grant_id_idx" ON "oauth_tokens"("grant_id");
CREATE INDEX "oauth_tokens_refresh_expires_at_idx" ON "oauth_tokens"("refresh_expires_at");

ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_grants" ADD CONSTRAINT "oauth_grants_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "oauth_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "oauth_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
