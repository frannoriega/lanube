import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  adjacentReleases,
  APP_VERSION,
  CURRENT_RELEASE,
  getRelease,
  RELEASES,
} from "./registry";
import { compareSemver, isNextVersion, isSemver } from "./semver";

/**
 * Invariantes del registro de novedades (milestone 28). Si uno falla porque cambiaste la
 * versión, la regla es: una versión nueva es **una entrada nueva al final de `RELEASES`**, con
 * su archivo `src/assets/changelog/<version>.md`, y el mismo número en `package.json`.
 */

const ASSETS = path.join(process.cwd(), "src/assets/changelog");
const pkg = JSON.parse(
  readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
) as { version: string };

describe("registro de novedades", () => {
  it("tiene al menos una versión", () => {
    expect(RELEASES.length).toBeGreaterThan(0);
  });

  it("package.json dice la misma versión que la última entrada", () => {
    expect(
      pkg.version,
      `package.json dice ${pkg.version} y el registro ${APP_VERSION}: subí los dos juntos.`,
    ).toBe(APP_VERSION);
    expect(CURRENT_RELEASE.version).toBe(APP_VERSION);
    const lock = JSON.parse(
      readFileSync(path.join(process.cwd(), "package-lock.json"), "utf8"),
    ) as { version: string; packages: Record<string, { version?: string }> };
    expect(lock.version, "package-lock.json: corré `npm install`").toBe(
      APP_VERSION,
    );
    expect(lock.packages[""].version).toBe(APP_VERSION);
  });

  it.each(RELEASES.map((r) => ({ ...r })))(
    "$version: semver válido, fecha ISO, textos y archivo",
    (r) => {
      expect(isSemver(r.version), `${r.version} no es MAJOR.MINOR.PATCH`).toBe(
        true,
      );
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${r.date}T12:00:00Z`))).toBe(false);
      expect(r.title.trim().length).toBeGreaterThan(0);
      expect(r.summary.trim().length).toBeGreaterThan(0);
      expect(r.file).toBe(`${r.version}.md`);
      const full = path.join(ASSETS, r.file);
      expect(existsSync(full), `falta ${full}`).toBe(true);
      expect(readFileSync(full, "utf8").trim().length).toBeGreaterThan(0);
    },
  );

  it("cada versión es el siguiente salto de la anterior y las fechas no retroceden", () => {
    for (let i = 1; i < RELEASES.length; i++) {
      const prev = RELEASES[i - 1];
      const next = RELEASES[i];
      expect(
        isNextVersion(prev.version, next.version),
        `${prev.version} → ${next.version} no es un salto semver válido`,
      ).toBe(true);
      expect(next.date >= prev.date).toBe(true);
    }
  });

  it("no hay archivos de versiones huérfanos", () => {
    const files = new Set(RELEASES.map((r) => r.file as string));
    const orphans = readdirSync(ASSETS).filter((f) => !files.has(f));
    expect(orphans).toEqual([]);
  });

  it("navega a la anterior y a la siguiente", () => {
    const first = RELEASES[0];
    expect(adjacentReleases(first.version).older).toBeNull();
    expect(adjacentReleases("9.9.9")).toEqual({ older: null, newer: null });
    expect(getRelease(first.version)?.version).toBe(first.version);
    expect(getRelease("0.0.0")).toBeNull();
  });
});

describe("semver", () => {
  it("valida MAJOR.MINOR.PATCH sin prefijos ni sufijos", () => {
    expect(isSemver("1.0.0")).toBe(true);
    expect(isSemver("10.20.30")).toBe(true);
    for (const bad of ["v1.0.0", "1.0", "1.0.0-rc.1", "01.0.0", "1.0.0+b"]) {
      expect(isSemver(bad), bad).toBe(false);
    }
  });

  it("compara numéricamente, no como texto", () => {
    expect(compareSemver("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("1.0.9", "2.0.0")).toBeLessThan(0);
    expect(() => compareSemver("1.0", "1.0.0")).toThrow();
  });

  it("acepta solo el siguiente salto", () => {
    expect(isNextVersion("1.2.3", "1.2.4")).toBe(true);
    expect(isNextVersion("1.2.3", "1.3.0")).toBe(true);
    expect(isNextVersion("1.2.3", "2.0.0")).toBe(true);
    expect(isNextVersion("1.2.3", "1.2.5")).toBe(false);
    expect(isNextVersion("1.2.3", "1.3.1")).toBe(false);
    expect(isNextVersion("1.2.3", "1.2.3")).toBe(false);
    expect(isNextVersion("1.2.3", "1.2.2")).toBe(false);
  });
});
