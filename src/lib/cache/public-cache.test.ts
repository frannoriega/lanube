import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Lo que mantiene cacheable el sitio público (milestone 25, P2). Lee los archivos en vez de
 * importarlos: `public-reads.ts` es `server-only` y usa `next/cache`.
 */

const ROOT = process.cwd();

function files(dir: string, match: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, match));
    else if (match.test(name)) out.push(relative(ROOT, p));
  }
  return out.sort();
}

const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** El código sin comentarios: los comentarios explican, por ejemplo, por qué no hay `connection()`. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const PUBLIC_REVALIDATE_SECONDS = Number(
  /export const PUBLIC_REVALIDATE_SECONDS = (\d+);/.exec(
    read("src/lib/cache/public-reads.ts"),
  )?.[1],
);

/** Lo que vuelve dinámica una página que lo use (o que lo use su layout). */
const REQUEST_BOUND = /\b(auth|connection|cookies|headers)\(\)|getSiteConfig\(/;

describe("caché del sitio público (milestone 25, P2)", () => {
  it("el layout raíz no depende del pedido", () => {
    expect(code("src/app/layout.tsx")).not.toMatch(REQUEST_BOUND);
  });

  it("ni el layout ni las páginas públicas dependen del pedido", () => {
    const publicFiles = files(join(ROOT, "src/app/(public)"), /\.tsx$/);
    expect(publicFiles.length).toBeGreaterThan(5);
    const offenders = publicFiles.filter((f) => REQUEST_BOUND.test(code(f)));
    expect(offenders).toEqual([]);
  });

  it("todo `revalidate` público es igual a PUBLIC_REVALIDATE_SECONDS", () => {
    expect(PUBLIC_REVALIDATE_SECONDS).toBeGreaterThan(0);
    const values = files(join(ROOT, "src/app/(public)"), /^page\.tsx$/)
      .map((f) => [f, /export const revalidate = (\d+);/.exec(read(f))?.[1]])
      .filter(([, v]) => v !== undefined);
    expect(values.length).toBeGreaterThan(5);
    for (const [f, v] of values) {
      expect({ f, v: Number(v) }).toEqual({ f, v: PUBLIC_REVALIDATE_SECONDS });
    }
  });

  it("el sitio público lee la base solo a través de las lecturas cacheadas", () => {
    // Se permiten tipos y helpers puros que no consultan la base.
    const PURE_DB_HELPERS = new Set([
      "getSpaceFaqs",
      "Space",
      "RegistrationPhase",
    ]);
    const dirs = [
      "src/app/(public)",
      "src/components/templates/landing",
      "src/components/organisms/layouts/public-layout",
    ];
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const f of files(join(ROOT, dir), /\.tsx?$/)) {
        const src = read(f);
        for (const m of src.matchAll(
          /import\s+(type\s+)?\{([^}]*)\}\s+from\s+"@\/lib\/db\/[^"]+"/g,
        )) {
          if (m[1]) continue;
          const names = m[2]
            .split(",")
            .map((n) => n.replace(/^\s*type\s+/, "").trim())
            .filter(Boolean);
          for (const n of names)
            if (!PURE_DB_HELPERS.has(n)) offenders.push(`${f}: ${n}`);
        }
        if (/\bprisma\./.test(src)) offenders.push(`${f}: prisma`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("toda ruta admin que escribe contenido público invalida su tag", () => {
    // Las subidas solo guardan un archivo (el registro se escribe después, en su propia ruta);
    // pedir revisión de una noticia no la publica.
    const NOT_PUBLIC = /\/(upload|attachment|request)\/route\.ts$/;
    const dirs = [
      "events",
      "news",
      "spaces",
      "themes",
      "site-config",
      "reservation-types",
    ];
    const missing: string[] = [];
    for (const d of dirs) {
      for (const f of files(
        join(ROOT, "src/app/api/admin", d),
        /^route\.ts$/,
      )) {
        if (NOT_PUBLIC.test(f)) continue;
        const src = read(f);
        const writes = /export async function (POST|PUT|PATCH|DELETE)\b/.test(
          src,
        );
        if (writes && !src.includes("revalidatePublic(")) missing.push(f);
      }
    }
    expect(missing).toEqual([]);
  });

  it("inscribirse y cancelar invalidan los eventos (fase «completo» de las tarjetas)", () => {
    for (const f of [
      "src/app/api/forms/[slug]/route.ts",
      "src/app/api/forms/response/[token]/route.ts",
    ]) {
      expect(read(f)).toContain("revalidatePublic(PUBLIC_TAGS.events)");
    }
  });
});
