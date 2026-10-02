-- ============================================================================
-- Milestone 17 — códigos de recuperación (ver prisma/models/passkeys.prisma).
-- ============================================================================
CREATE TABLE "recovery_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recovery_codes_user_id_code_hash_key" ON "recovery_codes"("user_id", "code_hash");

ALTER TABLE "recovery_codes"
    ADD CONSTRAINT "recovery_codes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
