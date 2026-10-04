-- ============================================================================
-- Milestone 19 — aceptaciones de políticas (ver prisma/models/policies.prisma).
-- ============================================================================
CREATE TYPE "PolicyAcceptanceContext" AS ENUM ('SIGNUP', 'REACCEPT');

CREATE TABLE "policy_acceptances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "policy_key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "context" "PolicyAcceptanceContext" NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "accepted_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "policy_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "policy_acceptances_user_id_policy_key_version_key" ON "policy_acceptances"("user_id", "policy_key", "version");

CREATE INDEX "policy_acceptances_user_id_policy_key_idx" ON "policy_acceptances"("user_id", "policy_key");

ALTER TABLE "policy_acceptances"
    ADD CONSTRAINT "policy_acceptances_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Una aceptación es evidencia legal: no se edita nunca. Se rechaza todo UPDATE a nivel de
-- base, así ni un bug ni un script a mano pueden reescribir qué versión aceptó alguien o
-- cuándo. Los DELETE quedan permitidos solo porque la cascada al borrar el usuario los
-- necesita (hoy no existe el borrado de cuentas; ver docs/OPEN_QUESTIONS.md, milestone 19).
CREATE FUNCTION policy_acceptances_reject_update() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'policy_acceptances es append-only: una aceptación no se modifica';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER policy_acceptances_no_update
    BEFORE UPDATE ON "policy_acceptances"
    FOR EACH ROW EXECUTE FUNCTION policy_acceptances_reject_update();
