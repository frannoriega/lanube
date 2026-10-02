-- ============================================================================
-- Milestone 17 — configuración de la cuenta: solicitudes de cambio de datos
-- protegidos (DNI y motivo para unirse) y passkeys.
--
-- Escrita a mano: `prisma migrate diff` además propone re-crear la FK polimórfica
-- `reservations.reservable_id` (ver CLAUDE.md, "Polymorphic reservable_id") y
-- otros desvíos ajenos a este cambio; nada de eso va acá.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Solicitudes de cambio de datos del perfil
-- --------------------------------------------------------------------------
CREATE TYPE "profile_change_fields" AS ENUM ('DNI', 'REASON_TO_JOIN');
CREATE TYPE "profile_change_statuses" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "profile_change_requests" (
    "id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "field" "profile_change_fields" NOT NULL,
    "current_value" TEXT NOT NULL,
    "requested_value" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "status" "profile_change_statuses" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" TEXT,
    "decision_reason" TEXT,
    "decided_at" BIGINT,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "profile_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "profile_change_requests_status_created_at_idx" ON "profile_change_requests"("status", "created_at");
CREATE INDEX "profile_change_requests_requester_id_created_at_idx" ON "profile_change_requests"("requester_id", "created_at");

-- Una sola solicitud PENDIENTE por (usuario, campo). Prisma no modela índices
-- parciales; la capa de datos lo chequea antes, y esto cubre la carrera de dos
-- envíos simultáneos.
CREATE UNIQUE INDEX "profile_change_requests_one_pending_per_field"
    ON "profile_change_requests"("requester_id", "field")
    WHERE "status" = 'PENDING';

ALTER TABLE "profile_change_requests"
    ADD CONSTRAINT "profile_change_requests_requester_id_fkey"
    FOREIGN KEY ("requester_id") REFERENCES "registered_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_change_requests"
    ADD CONSTRAINT "profile_change_requests_decided_by_id_fkey"
    FOREIGN KEY ("decided_by_id") REFERENCES "registered_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Permiso nuevo del catálogo (src/lib/rbac.ts): revisar estas solicitudes. Es una
-- tarea operativa (no de configuración técnica), así que se le da al rol ADMIN
-- sembrado; SUPERADMIN ya lo tiene implícito por `is_superadmin`.
UPDATE "roles"
SET "permissions" = array_append("permissions", 'users:profile-requests:review')
WHERE "key" = 'ADMIN'
  AND NOT ('users:profile-requests:review' = ANY("permissions"));

-- --------------------------------------------------------------------------
-- Passkeys (WebAuthn)
-- --------------------------------------------------------------------------
CREATE TABLE "passkey_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "device_type" TEXT NOT NULL,
    "backed_up" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
    "last_used_at" BIGINT,

    CONSTRAINT "passkey_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "passkey_credentials_credential_id_key" ON "passkey_credentials"("credential_id");
CREATE INDEX "passkey_credentials_user_id_idx" ON "passkey_credentials"("user_id");

ALTER TABLE "passkey_credentials"
    ADD CONSTRAINT "passkey_credentials_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "webauthn_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "purpose" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "expires_at" BIGINT NOT NULL,

    CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webauthn_challenges_expires_at_idx" ON "webauthn_challenges"("expires_at");

-- --------------------------------------------------------------------------
-- El cron diario también poda los desafíos WebAuthn vencidos. Cambia el tipo
-- de retorno, así que hay que borrar la función antes de recrearla.
-- --------------------------------------------------------------------------
DROP FUNCTION IF EXISTS prune_transient_rows(bigint);

CREATE FUNCTION prune_transient_rows(_now_ms bigint)
RETURNS TABLE (
  deleted_tokens bigint,
  deleted_rate_limits bigint,
  deleted_webauthn_challenges bigint
) AS $$
DECLARE
  tok_cnt bigint := 0;
  rl_cnt bigint := 0;
  wa_cnt bigint := 0;
  -- Margen sobre el vencimiento, para no borrar una fila que una request en
  -- vuelo todavía podría estar por consumir.
  grace_ms bigint := 86400000; -- 1 día
BEGIN
  DELETE FROM verification_tokens WHERE expires < (_now_ms - grace_ms);
  GET DIAGNOSTICS tok_cnt = ROW_COUNT;

  -- Una fila de rate limit se puede borrar cuando su ventana quedó atrás y no
  -- hay bloqueo vigente. Se usa updatedAt como "último contacto".
  DELETE FROM rate_limits
  WHERE "updatedAt" < (_now_ms - grace_ms)
    AND ("blockedUntil" IS NULL OR "blockedUntil" < _now_ms);
  GET DIAGNOSTICS rl_cnt = ROW_COUNT;

  -- Desafíos WebAuthn que nadie consumió (el usuario cerró el diálogo del
  -- navegador). Viven 5 minutos; con el margen de un día no hay carrera posible.
  DELETE FROM webauthn_challenges WHERE expires_at < (_now_ms - grace_ms);
  GET DIAGNOSTICS wa_cnt = ROW_COUNT;

  RETURN QUERY SELECT tok_cnt, rl_cnt, wa_cnt;
END;
$$ LANGUAGE plpgsql;
