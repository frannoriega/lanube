import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda de páginas del panel (arreglo de seguridad del 2026-11-17).
 *
 * El middleware solo exige `admin:access` para `/admin/**` (más una tabla corta de prefijos
 * de configuración). Las páginas de eventos y formularios no exigían su propio permiso, y
 * `/admin/events/[id]/participants` arma en el servidor la tabla de inscriptos con sus
 * respuestas: cualquier rol con acceso al panel la veía entrando por la URL.
 *
 * Regla: toda `page.tsx` bajo `/admin` llama a `requirePagePermission(` o tiene, entre ella y
 * `/admin`, un `layout.tsx` que lo hace. Las excepciones van en `EXEMPT` con su motivo.
 */

const ADMIN = join(process.cwd(), "src/app/(management)/admin");

const EXEMPT: Record<string, string> = {
  "dashboard/page.tsx":
    "El panel de inicio: alcanza con `admin:access` (cada tarjeta pide sus datos a una API con su propio permiso).",
};

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return pages(p);
    return e.name === "page.tsx" ? [p] : [];
  });
}

const guards = (file: string) =>
  existsSync(file) &&
  readFileSync(file, "utf8").includes("requirePagePermission(");

describe("páginas del panel", () => {
  for (const page of pages(ADMIN)) {
    const rel = relative(ADMIN, page);
    it(`${rel} exige un permiso`, () => {
      if (EXEMPT[rel]) return;
      let guarded = guards(page);
      // Sube por los layouts de la sección hasta `/admin` (sin incluirlo: ese solo exige
      // `admin:access`).
      for (let d = dirname(page); !guarded && d !== ADMIN; d = dirname(d)) {
        guarded = guards(join(d, "layout.tsx"));
      }
      expect(guarded, `${rel} no llama a requirePagePermission`).toBe(true);
    });
  }
});
