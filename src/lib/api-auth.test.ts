import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Toda ruta de `src/app/api/user/**` y `src/app/api/resources/**` actúa sobre la cuenta del
 * que llama, así que tiene que pasar por `requireActiveSession()` (o `requirePermission()`,
 * que lo incluye). Ese guard es lo único que corta por API a un suspendido (milestone-12
 * D24) y a una cuenta con políticas sin aceptar (milestone 19): el middleware no cubre
 * `/api/**`. Tres rutas usaban `auth()` a pelo y quedaban afuera de los dos chequeos.
 *
 * Si una ruta nueva de esas carpetas genuinamente no debe exigirlo, agregala a `EXEMPT` con
 * el motivo — no debilites el chequeo.
 */
const ROOTS = ["src/app/api/user", "src/app/api/resources"];

const EXEMPT: Record<string, string> = {};

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

const files = ROOTS.flatMap((root) =>
  routeFiles(join(process.cwd(), root)),
).map((f) => relative(process.cwd(), f));

describe("guard de cuenta activa en las rutas de usuario", () => {
  it("encuentra rutas para revisar", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.filter((f) => !(f in EXEMPT)))(
    "%s usa requireActiveSession o requirePermission",
    (file) => {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/requireActiveSession\(|requirePermission\(/);
      // Un `auth()` a pelo al lado del guard suele ser un handler que se lo saltea.
      expect(source).not.toMatch(/await auth\(\)/);
    },
  );
});
