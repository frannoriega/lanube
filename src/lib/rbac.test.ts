import { describe, expect, it } from "vitest";
import {
  hasPermission,
  isAdminRole,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "./rbac";
import { UserRole } from "@/types/prisma";

describe("rbac", () => {
  it("users have no admin permissions", () => {
    expect(ROLE_PERMISSIONS[UserRole.USER]).toHaveLength(0);
    expect(isAdminRole(UserRole.USER)).toBe(false);
  });

  it("admins can operate the panel but not the configuration", () => {
    expect(isAdminRole(UserRole.ADMIN)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, "events:manage")).toBe(true);
    expect(hasPermission(UserRole.ADMIN, "spaces:manage")).toBe(false);
    expect(hasPermission(UserRole.ADMIN, "resources:manage")).toBe(false);
    expect(hasPermission(UserRole.ADMIN, "reservation-types:manage")).toBe(
      false,
    );
    expect(hasPermission(UserRole.ADMIN, "users:roles:manage")).toBe(false);
  });

  it("superadmins have every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission(UserRole.SUPERADMIN, permission)).toBe(true);
    }
  });

  it("superadmin is a strict superset of admin", () => {
    for (const permission of ROLE_PERMISSIONS[UserRole.ADMIN]) {
      expect(hasPermission(UserRole.SUPERADMIN, permission)).toBe(true);
    }
  });

  it("tolerates unknown/absent roles", () => {
    expect(hasPermission(undefined, "admin:access")).toBe(false);
    expect(hasPermission(null, "admin:access")).toBe(false);
    expect(hasPermission("BOGUS", "admin:access")).toBe(false);
    expect(isAdminRole("")).toBe(false);
  });
});
