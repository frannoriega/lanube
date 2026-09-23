-- Milestone 9 — superadmin-defined roles & permissions.
--
-- Replaces the hardcoded `UserRole` enum column on `registered_users` with a FK into a new
-- `roles` table. The permission CATALOG stays code-defined (src/lib/rbac.ts) because each
-- permission string maps to a real requirePermission()/hasPermission() call site; what
-- becomes data is which of those permissions each role carries.
--
-- Cutover is behaviour-preserving: USER / ADMIN / SUPERADMIN / COMUNICADOR are seeded with
-- exactly the permission sets ROLE_PERMISSIONS held in code before this migration, and every
-- existing user is repointed at the row matching their old enum value.

CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_superadmin" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),
    "updated_at" BIGINT NOT NULL DEFAULT ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- Seeded roles. `is_system` rows cannot be renamed, deleted or re-scoped from the admin UI.
-- SUPERADMIN additionally carries `is_superadmin`, which short-circuits the permission check
-- to "always true" — so a permission added to the code catalog in a later deploy is never
-- accidentally withheld from the owner tier by a stale data row.
INSERT INTO "roles" ("id", "key", "name", "description", "is_system", "is_superadmin", "permissions") VALUES
    (
        'role_seed_user',
        'USER',
        'Usuario',
        'Tier base: reserva espacios y se inscribe a eventos, sin acceso al panel de administración.',
        true,
        false,
        ARRAY[]::TEXT[]
    ),
    (
        'role_seed_superadmin',
        'SUPERADMIN',
        'Superadministrador',
        'Tier de dueño/operador. Tiene todos los permisos, incluidos los que se agreguen en el futuro. No se puede editar ni eliminar.',
        true,
        true,
        ARRAY[]::TEXT[]
    ),
    (
        'role_seed_admin',
        'ADMIN',
        'Administrador',
        'Empleado: opera el día a día (reservas, check-in, eventos, usuarios, noticias).',
        false,
        false,
        ARRAY[
            'admin:access',
            'reservations:manage',
            'users:manage',
            'events:manage',
            'forms:manage',
            'reports:view',
            'checkin:manage',
            'incidents:manage',
            'news:manage',
            'news:approve'
        ]::TEXT[]
    ),
    (
        'role_seed_comunicador',
        'COMUNICADOR',
        'Comunicador',
        'Rol acotado: redacta y edita Noticias, pero no puede aprobarlas ni tocar el resto del panel.',
        false,
        false,
        ARRAY[
            'admin:access',
            'news:manage'
        ]::TEXT[]
    );

-- Repoint users at their equivalent role, then drop the enum column and type.
ALTER TABLE "registered_users" ADD COLUMN "role_id" TEXT;

UPDATE "registered_users" SET "role_id" = CASE "role"::text
    WHEN 'SUPERADMIN'  THEN 'role_seed_superadmin'
    WHEN 'ADMIN'       THEN 'role_seed_admin'
    WHEN 'COMUNICADOR' THEN 'role_seed_comunicador'
    ELSE 'role_seed_user'
END;

ALTER TABLE "registered_users" DROP COLUMN "role";
DROP TYPE "UserRole";

CREATE INDEX "registered_users_role_id_idx" ON "registered_users"("role_id");

-- Restrict, not cascade: deleting a role that users still hold must fail loudly, the same
-- precedent `reservation_types` already sets for in-use catalog rows.
ALTER TABLE "registered_users"
    ADD CONSTRAINT "registered_users_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
