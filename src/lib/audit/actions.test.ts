import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  auditActionLabel,
  CASCADED_ACTIONS,
} from "./actions";

/**
 * Milestone 2, item 7. These guard the two ways the audit trail rots silently:
 * an action with no label (renders as a raw id nobody can read), and a mutation route
 * that quietly stops writing entries.
 */

describe("audit action registry", () => {
  it("labels every action", () => {
    for (const action of Object.values(AUDIT_ACTIONS)) {
      expect(
        AUDIT_ACTION_LABELS[action],
        `missing label for ${action}`,
      ).toBeTruthy();
    }
  });

  it("has no label for an action that no longer exists", () => {
    const known = new Set<string>(Object.values(AUDIT_ACTIONS));
    for (const labelled of Object.keys(AUDIT_ACTION_LABELS)) {
      expect(known.has(labelled), `stale label: ${labelled}`).toBe(true);
    }
  });

  it("uses distinct action ids", () => {
    const ids = Object.values(AUDIT_ACTIONS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("follows the <entity>.<verb> shape", () => {
    for (const action of Object.values(AUDIT_ACTIONS)) {
      expect(action, `${action} is not <entity>.<verb>`).toMatch(
        /^[a-z][A-Za-z]*\.[a-z][a-zA-Z-]*(\.[a-z][a-zA-Z-]*)?$/,
      );
    }
  });

  it("falls back to the raw id for an unknown action", () => {
    // Entries written before an action was renamed must still render.
    expect(auditActionLabel("something.ancient")).toBe("something.ancient");
    expect(auditActionLabel(AUDIT_ACTIONS.roleCreate)).toBe("Creó un rol");
  });

  it("only marks real actions as cascaded", () => {
    const known = new Set<string>(Object.values(AUDIT_ACTIONS));
    for (const action of CASCADED_ACTIONS) {
      expect(known.has(action), `${action} is not a known action`).toBe(true);
    }
  });
});

/**
 * Coverage guard. Every admin route that mutates state must write an audit entry —
 * that is the whole point of the milestone, and the gap it closed was precisely a set of
 * routes nobody noticed were silent (every collection POST, for one).
 *
 * Exclusions are listed explicitly so adding one is a deliberate act with a reason,
 * not an omission.
 */
const AUDIT_EXEMPT: Record<string, string> = {
  "admin/events/upload":
    "Stores a file; the event that references it is audited on save.",
  "admin/events/attachment":
    "Stores a file; the event that references it is audited on save.",
  "admin/forms/upload":
    "Stores a file; the form that references it is audited on save.",
  "admin/news/upload":
    "Stores a file; the post that references it is audited on save.",
  "admin/spaces/upload":
    "Stores a file; the space that references it is audited on save.",
  "admin/incidents":
    "API is a 501 stub — nothing is written, so there is nothing to audit (milestone-10 F1.6).",
  "admin/incidents/[id]":
    "API is a 501 stub — nothing is written, so there is nothing to audit (milestone-10 F1.6).",
};

describe("admin mutation routes are audited", () => {
  // Walk rather than glob: node's globSync isn't in the @types version this repo pins.
  const apiAdminDir = join(process.cwd(), "src/app/api/admin");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name === "route.ts" ? [full] : [];
    });
  const files = walk(apiAdminDir).map((f) =>
    relative(process.cwd(), f).split("\\").join("/"),
  );

  it("finds the admin routes at all", () => {
    // Guards against the glob silently matching nothing and the suite passing vacuously.
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files)("%s", (file: string) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    const mutates = /export async function (POST|PUT|PATCH|DELETE)\b/.test(
      source,
    );
    if (!mutates) return;

    const route = file
      .replace("src/app/api/", "")
      .replace(/\/route\.ts$/, "")
      .split("\\")
      .join("/");
    if (route in AUDIT_EXEMPT) return;

    // Look for an actual CALL, not merely the import — an unused import would make
    // this guard pass while the route writes nothing (it did, on the first attempt).
    const withoutImports = source
      .split("\n")
      .filter(
        (line) => !/^\s*import\b/.test(line) && !/^\s*}\s*from\s/.test(line),
      )
      .join("\n");
    // Cualquiera de las puertas de entrada al bus de auditoría (milestone 16) cuenta.
    expect(
      /\b(recordAudit(FromSession)?|beginAudit|emitAudit)\s*\(/.test(
        withoutImports,
      ),
      `${route} mutates state but writes no audit entry. Instrument it, or add it to AUDIT_EXEMPT with a reason.`,
    ).toBe(true);
  });
});
