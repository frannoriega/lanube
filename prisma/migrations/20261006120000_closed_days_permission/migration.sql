-- Permiso nuevo del catálogo (src/lib/rbac.ts): gestionar los días cerrados (milestone 23).
-- Es operación diaria del coworking (cargar un feriado de la ciudad, unas vacaciones), no
-- configuración técnica, así que se le da al rol ADMIN sembrado; SUPERADMIN ya lo tiene
-- implícito por `is_superadmin`.
UPDATE "roles"
SET "permissions" = array_append("permissions", 'closed-days:manage')
WHERE "key" = 'ADMIN'
  AND NOT ('closed-days:manage' = ANY("permissions"));
