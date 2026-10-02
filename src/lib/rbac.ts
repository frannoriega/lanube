/**
 * RBAC. The *catalog* below is code-defined and stays that way: every string here
 * corresponds to a real `requirePermission()` / `hasPermission()` call site in a route,
 * page or middleware rule, so a permission invented at runtime would gate nothing.
 *
 * What IS data (milestone 9) is which catalog permissions each role carries — `Role` rows
 * a superadmin manages at /admin/roles. This module stays client-safe (pure data + pure
 * functions, no server imports); the DB-backed lookups live in `@/lib/rbac/roles`.
 */
export const PERMISSIONS = [
  /** Enter the /admin section at all. */
  "admin:access",
  "reservations:manage",
  "users:manage",
  /** Assign a role to a user. Distinct from roles:manage (defining what a role can do). */
  "users:roles:manage",
  /**
   * Aprobar o rechazar las solicitudes de cambio de DNI / motivo para unirse (milestone 17).
   * Nadie edita esos datos directamente: el usuario pide, un admin con este permiso decide.
   */
  "users:profile-requests:review",
  "events:manage",
  "forms:manage",
  "reports:view",
  "checkin:manage",
  "incidents:manage",
  /** Author/edit Noticias posts (including one's own drafts and submitting for review). */
  "news:manage",
  /** Approve/reject a Noticias post out of PENDING_REVIEW. Not granted to Comunicador. */
  "news:approve",
  // Configuration (superadmin)
  "spaces:manage",
  "resources:manage",
  "reservation-types:manage",
  "site-config:manage",
  "landing-themes:manage",
  /** Create roles and choose which permissions each one carries. */
  "roles:manage",
  /** View the audit trail (can expose role changes and bans). */
  "audit:view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

/** Drop anything not in the catalog — stored role rows can outlive a removed permission. */
export function sanitizePermissions(values: readonly string[]): Permission[] {
  return Array.from(new Set(values.filter(isPermission)));
}

/**
 * Human-readable grouping for the /admin/roles permission checklist. Every catalog entry
 * must appear in exactly one group — `permissionGroupCoverage()` is asserted in tests so a
 * newly added permission can't silently become unassignable from the UI.
 */
export const PERMISSION_GROUPS: ReadonlyArray<{
  label: string;
  description: string;
  permissions: readonly Permission[];
}> = [
  {
    label: "Acceso",
    description: "Entrada al panel de administración.",
    permissions: ["admin:access"],
  },
  {
    label: "Operación",
    description: "El día a día del espacio.",
    permissions: [
      "reservations:manage",
      "checkin:manage",
      "incidents:manage",
      "reports:view",
    ],
  },
  {
    label: "Eventos y formularios",
    description: "Talleres, cursos e inscripciones.",
    permissions: ["events:manage", "forms:manage"],
  },
  {
    label: "Noticias",
    description: "Redacción y aprobación de las notas públicas.",
    permissions: ["news:manage", "news:approve"],
  },
  {
    label: "Usuarios",
    description: "Alta, baja y asignación de roles.",
    permissions: [
      "users:manage",
      "users:roles:manage",
      "users:profile-requests:review",
    ],
  },
  {
    label: "Configuración",
    description: "Catálogos y apariencia del sitio.",
    permissions: [
      "spaces:manage",
      "resources:manage",
      "reservation-types:manage",
      "site-config:manage",
      "landing-themes:manage",
    ],
  },
  {
    label: "Gobernanza",
    description: "Definición de roles y trazabilidad.",
    permissions: ["roles:manage", "audit:view"],
  },
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "admin:access": "Acceder al panel",
  "reservations:manage": "Gestionar reservas",
  "users:manage": "Gestionar usuarios",
  "users:roles:manage": "Asignar roles a usuarios",
  "users:profile-requests:review": "Revisar cambios de DNI y motivo",
  "events:manage": "Gestionar eventos",
  "forms:manage": "Gestionar formularios",
  "reports:view": "Ver reportes",
  "checkin:manage": "Gestionar ingresos y egresos",
  "incidents:manage": "Gestionar incidentes",
  "news:manage": "Redactar noticias",
  "news:approve": "Aprobar o rechazar noticias",
  "spaces:manage": "Gestionar espacios",
  "resources:manage": "Gestionar recursos",
  "reservation-types:manage": "Gestionar tipos de reserva",
  "site-config:manage": "Configurar el sitio",
  "landing-themes:manage": "Gestionar temas de la portada",
  "roles:manage": "Definir roles y permisos",
  "audit:view": "Ver la auditoría",
};

/**
 * The shape every enforcement layer checks against, whether it came from the DB
 * (api-auth, page-auth) or from the JWT (middleware).
 */
export type PermissionSet = {
  /** True for the protected superadmin tier: holds every catalog permission, always. */
  isSuperadmin: boolean;
  permissions: readonly string[];
};

/** Nothing granted — an unauthenticated visitor, or a user on the base USER tier. */
export const NO_PERMISSIONS: PermissionSet = {
  isSuperadmin: false,
  permissions: [],
};

export function hasPermission(
  set: PermissionSet | null | undefined,
  permission: Permission,
): boolean {
  if (!set) return false;
  if (set.isSuperadmin) return true;
  return set.permissions.includes(permission);
}

/** Any role that can operate the admin panel at all. */
export function isAdminRole(set: PermissionSet | null | undefined): boolean {
  return hasPermission(set, "admin:access");
}

/** Stable keys of the roles the migration seeds; used to protect/identify them in code. */
export const SEEDED_ROLE_KEYS = {
  user: "USER",
  admin: "ADMIN",
  superadmin: "SUPERADMIN",
  comunicador: "COMUNICADOR",
} as const;

/** Label shown when a user has no role row (the base tier). */
export const NO_ROLE_LABEL = "Usuario";
