import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { effectiveAtMs } from "./pending";
import { POLICIES, POLICY_KEYS } from "./registry";

/**
 * Invariantes del registro de políticas (milestone 19). El más importante es el primero:
 * **una versión publicada no se edita**. Si este test falla porque cambiaste el texto de una
 * política, no actualices el hash: agregá una versión nueva (archivo + entrada al final de
 * `versions`, con su `changeSummary`). Para una errata, la versión nueva lleva
 * `reacceptance: "not-required"`.
 */

const ASSETS = path.join(process.cwd(), "src/assets/policies");
const CONTENT_MAP = path.join(
  process.cwd(),
  "src/components/organisms/policies/policy-content.tsx",
);

const allVersions = POLICY_KEYS.flatMap((key) =>
  POLICIES[key].versions.map((v) => ({ key, ...v })),
);

describe("registro de políticas", () => {
  it.each(allVersions)(
    "$key@$version: el archivo existe y su SHA-256 coincide (una versión publicada es inmutable)",
    ({ file, sha256 }) => {
      const full = path.join(ASSETS, file);
      expect(existsSync(full), `falta ${full}`).toBe(true);
      const actual = createHash("sha256")
        .update(readFileSync(full))
        .digest("hex");
      expect(
        actual,
        `El contenido de ${file} cambió. Una versión publicada no se edita: agregá una versión nueva. ` +
          `(Solo si esta versión todavía no se desplegó nunca, actualizá el hash a ${actual}.)`,
      ).toBe(sha256);
    },
  );

  it.each(allVersions)(
    "$key@$version: el texto es autocontenido (sin import, export ni expresiones)",
    ({ file }) => {
      // Si una política importa un valor (un email de contacto, por ejemplo), lo que se
      // muestra deja de estar cubierto por el hash: cambia sin que cambie el archivo. Pasó:
      // la v1 importaba un `email` que se borró en septiembre de 2026, y la política se
      // publicó con el correo de contacto vacío durante un mes. Todo va escrito literal.
      const source = readFileSync(path.join(ASSETS, file), "utf8");
      expect(source).not.toMatch(/^\s*(import|export)\s/m);
      expect(source).not.toMatch(/[{}]/);
    },
  );

  it.each(allVersions)(
    "$key@$version: tiene su import en POLICY_CONTENT",
    ({ file }) => {
      const source = readFileSync(CONTENT_MAP, "utf8");
      expect(source).toContain(`"${file}"`);
      expect(source).toContain(`@/assets/policies/${file}`);
    },
  );

  it.each(POLICY_KEYS)(
    "%s: versiones con id único, formato de fecha y vigencia estrictamente creciente",
    (key) => {
      const versions = POLICIES[key].versions;
      expect(versions.length).toBeGreaterThan(0);
      const ids = versions.map((v) => v.version);
      expect(new Set(ids).size).toBe(ids.length);
      for (const v of versions) {
        expect(v.version).toMatch(/^\d{4}-\d{2}-\d{2}(-\d+)?$/);
        expect(v.effectiveAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(v.file).toBe(`${key}/${v.version}.mdx`);
      }
      for (let i = 1; i < versions.length; i++) {
        expect(effectiveAtMs(versions[i])).toBeGreaterThan(
          effectiveAtMs(versions[i - 1]),
        );
      }
    },
  );

  it.each(POLICY_KEYS)(
    "%s: toda versión salvo la primera explica qué cambió",
    (key) => {
      POLICIES[key].versions.slice(1).forEach((v) => {
        expect(
          (v.changeSummary ?? []).length,
          `${key}@${v.version} necesita changeSummary`,
        ).toBeGreaterThan(0);
      });
    },
  );

  it("los slugs son únicos", () => {
    const slugs = POLICY_KEYS.map((k) => POLICIES[k].slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
