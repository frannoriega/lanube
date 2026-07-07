-- RBAC: add the SUPERADMIN role. Permissions are defined in code (src/lib/rbac.ts);
-- the role is the only thing persisted.
ALTER TYPE "UserRole" ADD VALUE 'SUPERADMIN';
