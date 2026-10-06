import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Milestone 24: `Space` guarda espacios (se reservan, alberga eventos) **y** áreas comunes
 * («amenities»: solo se muestran). `getPublicSpaces()` devuelve los dos juntos, así que quien
 * necesite solo lugares reservables o donde cargar eventos tiene que usar
 * `getSpacesByKind("SPACE")` (o `getReservableSpaces()`).
 *
 * Este test falla si `getPublicSpaces` aparece en un archivo nuevo: hay que decidir a conciencia
 * si ese lugar debe mostrar también las áreas comunes y, si es así, sumarlo a `ALLOWED` con el
 * motivo. No debilites el chequeo.
 */
const ALLOWED: Record<string, string> = {
  "src/lib/db/spaces.ts": "la definición",
  "src/app/(public)/spaces/page.tsx":
    "la página pública muestra espacios y áreas comunes, en dos bloques",
  "src/app/api/admin/spaces/route.ts":
    "el listado del panel muestra ambos tipos (pestañas) y el picker de eventos filtra con ?reservable=1",
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === "generated") return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("getPublicSpaces() y las áreas comunes", () => {
  it("solo lo usan los archivos que muestran ambos tipos", () => {
    const users = sourceFiles(join(process.cwd(), "src"))
      .map((f) => relative(process.cwd(), f))
      .filter((f) => /getPublicSpaces\b/.test(readFileSync(f, "utf8")))
      .sort();
    expect(users).toEqual(Object.keys(ALLOWED).sort());
  });
});
