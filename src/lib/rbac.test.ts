import { describe, expect, it } from "vitest";
import {
  hasPermission,
  isAdminRole,
  isPermission,
  NO_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  PERMISSIONS,
  sanitizePermissions,
  type Permission,
  type PermissionSet,
} from "./rbac";

/**
 * Milestone 9 moved role→permission assignment into the DB, so these tests cover the pure
 * checking logic and the integrity of the code-defined catalog. The permission sets the
 * seeded roles carry are asserted against the migration in `roles.seed.test.ts`.
 */

const set = (permissions: Permission[]): PermissionSet => ({
  isSuperadmin: false,
  permissions,
});

const SUPERADMIN: PermissionSet = { isSuperadmin: true, permissions: [] };

describe("hasPermission", () => {
  it("grants only what the set lists", () => {
    const admin = set(["admin:access", "events:manage"]);
    expect(hasPermission(admin, "events:manage")).toBe(true);
    expect(hasPermission(admin, "spaces:manage")).toBe(false);
    expect(hasPermission(admin, "roles:manage")).toBe(false);
  });

  it("grants everything to the superadmin tier, stored list notwithstanding", () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission(SUPERADMIN, permission)).toBe(true);
    }
  });

  it("grants a permission added to the catalog later without a data change", () => {
    // The whole point of the isSuperadmin bypass: a new PERMISSIONS entry is covered the
    // moment it ships, instead of waiting for someone to edit a stored role row.
    const hypothetical = "some:future:permission" as Permission;
    expect(hasPermission(SUPERADMIN, hypothetical)).toBe(true);
    expect(hasPermission(set([]), hypothetical)).toBe(false);
  });

  it("denies when there is no set at all", () => {
    expect(hasPermission(undefined, "admin:access")).toBe(false);
    expect(hasPermission(null, "admin:access")).toBe(false);
    expect(hasPermission(NO_PERMISSIONS, "admin:access")).toBe(false);
  });
});

describe("isAdminRole", () => {
  it("is exactly admin:access", () => {
    expect(isAdminRole(set(["admin:access"]))).toBe(true);
    expect(isAdminRole(set(["news:manage"]))).toBe(false);
    expect(isAdminRole(SUPERADMIN)).toBe(true);
    expect(isAdminRole(NO_PERMISSIONS)).toBe(false);
  });
});

describe("catalog integrity", () => {
  it("recognises catalog entries and rejects invented ones", () => {
    expect(isPermission("audit:view")).toBe(true);
    expect(isPermission("audit:destroy")).toBe(false);
  });

  it("drops non-catalog strings on sanitize, and de-duplicates", () => {
    expect(
      sanitizePermissions(["admin:access", "admin:access", "not:a:permission"]),
    ).toEqual(["admin:access"]);
  });

  it("labels every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(PERMISSION_LABELS[permission]).toBeTruthy();
    }
  });

  it("puts every permission in exactly one UI group", () => {
    // Guards the /admin/roles checklist: a permission missing from PERMISSION_GROUPS is
    // one a superadmin can never grant, which would fail silently at runtime.
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.permissions);
    expect([...grouped].sort()).toEqual([...PERMISSIONS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});
