import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * La CSP global de `next.config.ts` pisa los headers que pone una ruta. El proxy de archivos de
 * participantes necesita la suya (`sandbox` para lo que no es PDF, milestone 25 S1), así que la
 * regla global tiene que dejarlo afuera — y solo a él. Se lee el archivo porque importarlo
 * arrastra `@next/mdx`.
 */
const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

/** El `source` de la regla que pone `Content-Security-Policy`. */
function cspSource(): string {
  const m =
    /source:\s*"([^"]+)",\s*headers:\s*\[\s*\{\s*key:\s*"Content-Security-Policy"/.exec(
      config,
    );
  if (!m)
    throw new Error("no se encontró la regla de la CSP en next.config.ts");
  return m[1];
}

/** `/((?!x).*)` de path-to-regexp → RegExp anclada (el grupo sin nombre es una regex cruda). */
function toRegExp(source: string): RegExp {
  return new RegExp(`^${source.replace(/^\/\(/, "/(?:")}$`);
}

describe("CSP global (milestone 25, S1)", () => {
  const re = toRegExp(cspSource());

  it("se aplica a todo el sitio", () => {
    for (const p of [
      "/",
      "/news",
      "/admin/events/abc/participants",
      "/api/admin/events/abc",
      "/api/admin/events/abc/participants/decision",
      "/forms/response/tok",
    ]) {
      expect(re.test(p), p).toBe(true);
    }
  });

  it("no al proxy de archivos, que pone su propia CSP sandbox", () => {
    expect(re.test("/api/admin/events/abc/participants/file")).toBe(false);
  });
});
