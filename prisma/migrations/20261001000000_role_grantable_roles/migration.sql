-- Ids of the OTHER roles a holder of this role may assign to a user (see the doc comment
-- on Role.grantableRoleIds in prisma/models/roles.prisma). A superadmin bypasses this list
-- entirely, so it's left empty for SUPERADMIN. ADMIN is seeded to the one example given in
-- the request that motivated this: an admin can promote someone to USER or COMUNICADOR, but
-- not to ADMIN or SUPERADMIN.
ALTER TABLE "roles" ADD COLUMN "grantable_role_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "roles"
SET "grantable_role_ids" = ARRAY['role_seed_user', 'role_seed_comunicador']
WHERE "key" = 'ADMIN';
