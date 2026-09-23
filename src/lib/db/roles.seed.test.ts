import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isPermission, PERMISSIONS } from "@/lib/rbac";

/**
 * Milestone 9 promised a behaviour-preserving cutover: the roles the migration seeds must
 * carry exactly the permission sets `ROLE_PERMISSIONS` held in code before roles became
 * data. These are read straight out of the migration SQL so the assertion can't drift into
 * restating whatever the code happens to say today.
 */

const MIGRATION = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260924000000_dynamic_roles/migration.sql",
  ),
  "utf8",
);

/** The permission sets ROLE_PERMISSIONS held immediately before this milestone. */
const PRE_MIGRATION_ROLE_PERMISSIONS = {
  USER: [],
  ADMIN: [
    "admin:access",
    "reservations:manage",
    "users:manage",
    "events:manage",
    "forms:manage",
    "reports:view",
    "checkin:manage",
    "incidents:manage",
    "news:manage",
    "news:approve",
  ],
  COMUNICADOR: ["admin:access", "news:manage"],
} as const;

/** Pull the ARRAY[...] permission literal that follows a seeded role's key. */
function seededPermissions(roleKey: string): string[] {
  const block = MIGRATION.split(`'${roleKey}',`)[1];
  expect(block, `role ${roleKey} is not seeded`).toBeDefined();
  const match = block.match(/ARRAY\[([\s\S]*?)\]::TEXT\[\]/);
  if (!match || !match[1].trim()) return [];
  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^'|'$/g, ""))
    .filter(Boolean);
}

describe("dynamic roles migration seed", () => {
  it.each(Object.entries(PRE_MIGRATION_ROLE_PERMISSIONS))(
    "seeds %s with its pre-migration permission set",
    (roleKey, expected) => {
      expect(seededPermissions(roleKey).sort()).toEqual([...expected].sort());
    },
  );

  it("seeds SUPERADMIN as the implicit-all tier, not a stored list", () => {
    // An explicit list would silently withhold any permission added in a later deploy.
    expect(seededPermissions("SUPERADMIN")).toEqual([]);
    expect(MIGRATION).toMatch(/'SUPERADMIN',[\s\S]*?true,\s*\n\s*true,/);
  });

  it("protects USER and SUPERADMIN from being edited or deleted", () => {
    for (const roleKey of ["USER", "SUPERADMIN"]) {
      const block = MIGRATION.split(`'${roleKey}',`)[1].split("),")[0];
      expect(block, `${roleKey} must be is_system`).toMatch(/\btrue\b/);
    }
  });

  it("only seeds permissions that exist in the code catalog", () => {
    for (const roleKey of ["USER", "ADMIN", "COMUNICADOR", "SUPERADMIN"]) {
      for (const permission of seededPermissions(roleKey)) {
        expect(
          isPermission(permission),
          `${permission} (seeded for ${roleKey}) is not in PERMISSIONS`,
        ).toBe(true);
      }
    }
  });

  it("drops the UserRole enum the roles table replaces", () => {
    expect(MIGRATION).toContain('DROP TYPE "UserRole"');
    expect(MIGRATION).toContain(
      'ALTER TABLE "registered_users" DROP COLUMN "role"',
    );
  });

  it("keeps roles:manage out of every non-superadmin seeded role", () => {
    // Defining roles is an owner-tier capability; seeding it to ADMIN would defeat the
    // employee-vs-owner separation this milestone exists to draw.
    expect(PERMISSIONS).toContain("roles:manage");
    for (const roleKey of ["USER", "ADMIN", "COMUNICADOR"]) {
      expect(seededPermissions(roleKey)).not.toContain("roles:manage");
    }
  });
});
