import { UserRole } from "@/types/prisma";

/**
 * RBAC: roles carry a predefined set of permissions. Nothing besides the role is
 * persisted — grant/revoke happens by editing these maps. Client-safe (pure data,
 * no server imports); API routes enforce via requirePermission() in lib/api-auth.ts.
 */
export const PERMISSIONS = [
  /** Enter the /admin section at all. */
  "admin:access",
  "reservations:manage",
  "users:manage",
  /** Change another user's role (assign/revoke ADMIN). */
  "users:roles:manage",
  "events:manage",
  "forms:manage",
  "reports:view",
  "checkin:manage",
  "incidents:manage",
  // Configuration (superadmin)
  "spaces:manage",
  "resources:manage",
  "reservation-types:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ADMIN_PERMISSIONS: readonly Permission[] = [
  "admin:access",
  "reservations:manage",
  "users:manage",
  "events:manage",
  "forms:manage",
  "reports:view",
  "checkin:manage",
  "incidents:manage",
];

const SUPERADMIN_PERMISSIONS: readonly Permission[] = [
  ...ADMIN_PERMISSIONS,
  "users:roles:manage",
  "spaces:manage",
  "resources:manage",
  "reservation-types:manage",
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.USER]: [],
  [UserRole.ADMIN]: ADMIN_PERMISSIONS,
  [UserRole.SUPERADMIN]: SUPERADMIN_PERMISSIONS,
};

export function hasPermission(
  role: UserRole | string | undefined | null,
  permission: Permission,
): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  return permissions?.includes(permission) ?? false;
}

/** Any role that can operate the admin panel (ADMIN or SUPERADMIN). */
export function isAdminRole(
  role: UserRole | string | undefined | null,
): boolean {
  return hasPermission(role, "admin:access");
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.USER]: "Usuario",
  [UserRole.ADMIN]: "Administrador",
  [UserRole.SUPERADMIN]: "Superadministrador",
};
