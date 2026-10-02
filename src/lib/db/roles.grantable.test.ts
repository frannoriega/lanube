import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The role-assignment sub-permission system: a role's `grantableRoleIds` limits which
 * roles a holder of it may assign to a user (see the doc comment on `Role.grantableRoleIds`
 * in prisma/models/roles.prisma). This checks the seed migration gives ADMIN exactly the
 * example from the request that motivated it — USER and COMUNICADOR, nothing else.
 */

const MIGRATION = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20261001000000_role_grantable_roles/migration.sql",
  ),
  "utf8",
);

describe("role grantable-roles migration", () => {
  it("adds the column with an empty default", () => {
    expect(MIGRATION).toMatch(
      /ADD COLUMN "grantable_role_ids" TEXT\[\] NOT NULL DEFAULT ARRAY\[\]::TEXT\[\]/,
    );
  });

  it("seeds ADMIN to grant only USER and COMUNICADOR", () => {
    const match = MIGRATION.match(
      /SET "grantable_role_ids" = ARRAY\[([\s\S]*?)\]\s*\nWHERE "key" = 'ADMIN'/,
    );
    expect(
      match,
      "no grantable_role_ids UPDATE for ADMIN found",
    ).not.toBeNull();
    const ids = match![1]
      .split(",")
      .map((v) => v.trim().replace(/^'|'$/g, ""))
      .filter(Boolean);
    expect(ids.sort()).toEqual(
      ["role_seed_comunicador", "role_seed_user"].sort(),
    );
  });

  it("never seeds the superadmin role id into any grantable list", () => {
    expect(MIGRATION).not.toContain("role_seed_superadmin");
  });
});
